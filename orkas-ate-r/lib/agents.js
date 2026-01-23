function buildAgentEntries(plan, mode) {
  const tasks = Array.isArray(plan.tasks) ? plan.tasks : [];
  const entries = [];

  if (mode === "subtask") {
    tasks.forEach((task) => {
      const subtasks = Array.isArray(task.subtasks) ? task.subtasks : [];
      if (!subtasks.length) {
        entries.push({ type: "task", task });
        return;
      }
      subtasks.forEach((subtask) => {
        entries.push({ type: "subtask", task, subtask });
      });
    });
    return entries;
  }

  tasks.forEach((task) => {
    entries.push({ type: "task", task });
  });

  return entries;
}

function buildAgentName(plan, task, subtask) {
  const parts = [plan.title || "Plan"];
  if (task && task.id) {
    parts.push(task.id);
  }
  if (subtask && subtask.id) {
    parts.push(subtask.id);
  }
  return parts.join(" - ");
}

function formatKeyValueBlock(label, valueMap) {
  if (!valueMap || typeof valueMap !== "object") {
    return null;
  }
  const entries = Object.entries(valueMap).filter(([, value]) => {
    return value !== undefined && value !== null && value !== "";
  });
  if (!entries.length) {
    return null;
  }
  const lines = [label];
  entries.forEach(([key, value]) => {
    lines.push(`- ${key}: ${value}`);
  });
  return lines.join("\n");
}

function formatListBlock(label, items) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!values.length) {
    return null;
  }
  const lines = [label];
  values.forEach((item) => {
    lines.push(`- ${item}`);
  });
  return lines.join("\n");
}

function formatSubtask(subtask) {
  const lines = [`- ${subtask.id || "Subtask"}: ${subtask.goal || ""}`.trim()];

  if (Array.isArray(subtask.edits) && subtask.edits.length) {
    lines.push("  Edits:");
    subtask.edits.forEach((edit) => lines.push(`    - ${edit}`));
  }

  if (Array.isArray(subtask.files) && subtask.files.length) {
    lines.push("  Files:");
    subtask.files.forEach((file) => lines.push(`    - ${file}`));
  }

  if (Array.isArray(subtask.validation) && subtask.validation.length) {
    lines.push("  Validation:");
    subtask.validation.forEach((check) => lines.push(`    - ${check}`));
  }

  if (subtask.commit) {
    lines.push(`  Commit: ${subtask.commit}`);
  }

  return lines;
}

function buildAgentPrompt(plan, task, subtask) {
  const lines = [];

  if (plan.title) {
    lines.push(`Plan: ${plan.title}`);
  }

  const scopeBlock = formatKeyValueBlock(
    "Scope constraints:",
    plan.scope_constraints
  );
  if (scopeBlock) {
    lines.push("", scopeBlock);
  }

  const assumptionsBlock = formatListBlock("Assumptions:", plan.assumptions);
  if (assumptionsBlock) {
    lines.push("", assumptionsBlock);
  }

  const questionsBlock = formatListBlock(
    "Open questions:",
    plan.open_questions
  );
  if (questionsBlock) {
    lines.push("", questionsBlock);
  }

  if (task) {
    lines.push("", `Task group: ${task.id || ""} - ${task.name || ""}`.trim());
    if (Array.isArray(task.depends_on) && task.depends_on.length) {
      lines.push(`Depends on: ${task.depends_on.join(", ")}`);
    }
  }

  if (subtask) {
    lines.push("", "Target subtask:");
    lines.push(formatSubtask(subtask).join("\n"));
  } else if (task && Array.isArray(task.subtasks) && task.subtasks.length) {
    lines.push("", "Subtasks:");
    task.subtasks.forEach((item) => {
      lines.push(formatSubtask(item).join("\n"));
    });
  }

  return lines.filter((line) => line !== null).join("\n");
}

module.exports = {
  buildAgentEntries,
  buildAgentName,
  buildAgentPrompt,
};
