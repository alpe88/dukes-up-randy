const fs = require("fs");
const path = require("path");

const DEFAULT_PLAN_FILE = "oar-plan.json";
const DEFAULT_TEMPLATE_FILE = "oar-plan.template.json";

function createTemplatePlan() {
  return {
    title: "<one-line plan title>",
    scope_constraints: {
      runtime: "<nodejs version or other constraint>",
      feature_parity: "<true|false>",
      lambda_granularity: "<one endpoint per lambda|domain lambda|...>",
      incremental_migration: "<notes>",
      admin_testing_ui: "<notes>",
      infra: "<notes>",
    },
    assumptions: ["<assumption 1>", "<assumption 2>"],
    open_questions: ["<question 1>", "<question 2>"],
    tasks: [
      {
        id: "Task 1",
        name: "<group name>",
        depends_on: [],
        subtasks: [
          {
            id: "Task 1A",
            goal: "<goal>",
            edits: ["<edit summary 1>", "<edit summary 2>"],
            files: ["<path/to/file-1>", "<path/to/file-2>"],
            validation: ["<how to validate>"],
            commit: "<action: brief sentence>",
          },
        ],
      },
      {
        id: "Task 2",
        name: "<group name>",
        depends_on: ["Task 1"],
        subtasks: [
          {
            id: "Task 2A",
            goal: "<goal>",
            edits: ["<edit summary>"],
            files: ["<path/to/file>"],
            validation: ["<how to validate>"],
            commit: "<action: brief sentence>",
          },
          {
            id: "Task 2B",
            goal: "<goal>",
            edits: ["<edit summary>"],
            files: ["<path/to/file>"],
            validation: ["<how to validate>"],
            commit: "<action: brief sentence>",
          },
        ],
      },
    ],
  };
}

function createPlanFromPrompt(prompt) {
  const plan = createTemplatePlan();
  const trimmed = prompt.trim();
  plan.title = trimmed.length ? trimmed : "Untitled plan";
  return plan;
}

function writeJsonFile(filePath, data, { force = false } = {}) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (fs.existsSync(resolved) && !force) {
    throw new Error(
      `File already exists at ${resolved}. Use --force to overwrite.`
    );
  }
  fs.writeFileSync(resolved, JSON.stringify(data, null, 2));
  return resolved;
}

function readJsonFile(filePath) {
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }
  const contents = fs.readFileSync(resolved, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid JSON in ${resolved}: ${error.message}`);
  }
  return { data: parsed, path: resolved };
}

function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("Plan must be a JSON object.");
    return errors;
  }
  if (!plan.title || typeof plan.title !== "string") {
    errors.push("Plan title must be a string.");
  }
  if (!Array.isArray(plan.tasks)) {
    errors.push("Plan tasks must be an array.");
  } else {
    const taskIds = new Set();
    const dependencyMap = new Map();
    plan.tasks.forEach((task, index) => {
      if (!task || typeof task !== "object") {
        errors.push(`Task ${index + 1} must be an object.`);
        return;
      }
      if (!task.id || typeof task.id !== "string") {
        errors.push(`Task ${index + 1} is missing a string id.`);
      } else if (taskIds.has(task.id)) {
        errors.push(`Task id "${task.id}" is duplicated.`);
      } else {
        taskIds.add(task.id);
      }
      if (!task.name || typeof task.name !== "string") {
        errors.push(`Task ${index + 1} is missing a string name.`);
      }
      if (task.depends_on !== undefined && !Array.isArray(task.depends_on)) {
        errors.push(
          `Task ${index + 1} depends_on must be an array if provided.`
        );
      }
      const dependsOn = Array.isArray(task.depends_on) ? task.depends_on : [];
      if (task.id && typeof task.id === "string") {
        dependencyMap.set(task.id, dependsOn);
      }
      if (task.subtasks !== undefined && !Array.isArray(task.subtasks)) {
        errors.push(
          `Task ${index + 1} subtasks must be an array if provided.`
        );
      } else if (Array.isArray(task.subtasks)) {
        task.subtasks.forEach((subtask, subIndex) => {
          if (!subtask || typeof subtask !== "object") {
            errors.push(
              `Task ${index + 1} subtask ${subIndex + 1} must be an object.`
            );
            return;
          }
          if (!subtask.id || typeof subtask.id !== "string") {
            errors.push(
              `Task ${index + 1} subtask ${subIndex + 1} is missing a string id.`
            );
          }
          if (!subtask.goal || typeof subtask.goal !== "string") {
            errors.push(
              `Task ${index + 1} subtask ${subIndex + 1} is missing a string goal.`
            );
          }
        });
      }
    });

    dependencyMap.forEach((dependencies, taskId) => {
      dependencies.forEach((dependency) => {
        if (!taskIds.has(dependency)) {
          errors.push(
            `Task "${taskId}" depends_on "${dependency}", which was not found.`
          );
        }
      });
    });

    const visited = new Set();
    const visiting = new Set();
    function detectCycle(taskId, chain) {
      if (visiting.has(taskId)) {
        errors.push(
          `Task dependency cycle detected: ${chain.join(" -> ")} -> ${taskId}`
        );
        return;
      }
      if (visited.has(taskId)) {
        return;
      }
      visiting.add(taskId);
      const deps = dependencyMap.get(taskId) || [];
      deps.forEach((dep) => {
        if (taskIds.has(dep)) {
          detectCycle(dep, [...chain, taskId]);
        }
      });
      visiting.delete(taskId);
      visited.add(taskId);
    }

    dependencyMap.forEach((_, taskId) => {
      detectCycle(taskId, []);
    });
  }
  return errors;
}

function loadPlanFile(filePath) {
  const { data, path: resolved } = readJsonFile(filePath);
  const errors = validatePlan(data);
  if (errors.length) {
    const message = ["Plan validation failed:"]
      .concat(errors.map((error) => `- ${error}`))
      .join("\n");
    throw new Error(message);
  }
  return { plan: data, path: resolved };
}

module.exports = {
  DEFAULT_PLAN_FILE,
  DEFAULT_TEMPLATE_FILE,
  createTemplatePlan,
  createPlanFromPrompt,
  writeJsonFile,
  loadPlanFile,
  validatePlan,
};
