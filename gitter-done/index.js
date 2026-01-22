#!/usr/bin/env node

const fs = require("fs");
const { program } = require("commander");
const {
  DEFAULT_DATA_FILE,
  PROJECT_STATUSES,
  MILESTONE_STATUSES,
  resolveDataFile,
  createEmptyRoadmap,
  loadRoadmap,
  saveRoadmap,
  normalize,
  generateId,
  findProject,
  findMilestone,
  isValidDate,
} = require("./lib/roadmap");

function exitWithError(message) {
  console.error(message);
  process.exit(1);
}

function getFilePath() {
  const options = program.opts();
  return resolveDataFile(options.file);
}

function getRoadmap(filePath, { createIfMissing = false } = {}) {
  let roadmap;
  try {
    roadmap = loadRoadmap(filePath);
  } catch (error) {
    exitWithError(error.message);
  }

  if (!roadmap) {
    if (!createIfMissing) {
      exitWithError(
        `No roadmap found at ${filePath}. Run "gitter-done init" first.`
      );
    }

    roadmap = createEmptyRoadmap();
    saveRoadmap(filePath, roadmap);
  }

  roadmap.projects.forEach((project) => {
    if (!Array.isArray(project.milestones)) {
      project.milestones = [];
    }
  });

  return roadmap;
}

function ensureValidStatus(value, allowed, label) {
  if (!value) {
    return value;
  }

  if (!allowed.includes(value)) {
    exitWithError(
      `${label} must be one of: ${allowed.join(", ")}. Received "${value}".`
    );
  }

  return value;
}

function ensureValidDate(value, label) {
  if (!value) {
    return;
  }

  if (!isValidDate(value)) {
    exitWithError(`${label} must be in YYYY-MM-DD format. Received "${value}".`);
  }
}

function summarizeMilestones(milestones) {
  if (!milestones.length) {
    return "No milestones";
  }

  const counts = {};
  MILESTONE_STATUSES.forEach((status) => {
    counts[status] = 0;
  });

  milestones.forEach((milestone) => {
    const status = milestone.status || "planned";
    if (counts[status] === undefined) {
      counts[status] = 0;
    }
    counts[status] += 1;
  });

  const parts = MILESTONE_STATUSES.filter((status) => counts[status]).map(
    (status) => `${counts[status]} ${status}`
  );

  return parts.length
    ? `${milestones.length} total (${parts.join(", ")})`
    : `${milestones.length} total`;
}

function buildDetailLine(parts) {
  if (!parts.length) {
    return null;
  }
  return parts.join(" | ");
}

program
  .name("gitter-done")
  .description(
    "Manage projects and milestones for a lightweight product roadmap"
  )
  .version("0.1.0")
  .option(
    "-f, --file <path>",
    "Path to the roadmap file",
    DEFAULT_DATA_FILE
  )
  .showHelpAfterError();

program
  .command("init")
  .description("Create a roadmap file in the current repository")
  .option("--force", "Overwrite the roadmap file if it exists")
  .action((options) => {
    const filePath = getFilePath();

    if (fs.existsSync(filePath) && !options.force) {
      exitWithError(
        `Roadmap already exists at ${filePath}. Use --force to overwrite.`
      );
    }

    const roadmap = createEmptyRoadmap();
    saveRoadmap(filePath, roadmap);
    console.log(`Initialized roadmap at ${filePath}`);
  });

const project = program.command("project").description("Manage projects");

project
  .command("add")
  .argument("<name>", "Project name")
  .option("-d, --description <text>", "Project description")
  .option("-o, --owner <owner>", "Owner or team")
  .option(
    "-s, --status <status>",
    `Project status (${PROJECT_STATUSES.join(", ")})`,
    "active"
  )
  .description("Add a project to the roadmap")
  .action((name, options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath, { createIfMissing: true });
    const normalizedName = normalize(name);

    if (
      roadmap.projects.some(
        (existing) => existing.name && normalize(existing.name) === normalizedName
      )
    ) {
      exitWithError(`Project "${name}" already exists.`);
    }

    const status = ensureValidStatus(
      options.status,
      PROJECT_STATUSES,
      "Project status"
    );

    const now = new Date().toISOString();
    const projectRecord = {
      id: generateId("proj", name),
      name,
      status,
      milestones: [],
      createdAt: now,
      updatedAt: now,
    };

    if (options.description) {
      projectRecord.description = options.description.trim();
    }

    if (options.owner) {
      projectRecord.owner = options.owner.trim();
    }

    roadmap.projects.push(projectRecord);
    saveRoadmap(filePath, roadmap);
    console.log(`Added project "${name}".`);
  });

project
  .command("list")
  .option("--json", "Output raw JSON")
  .description("List projects in the roadmap")
  .action((options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);

    if (options.json) {
      console.log(JSON.stringify(roadmap.projects, null, 2));
      return;
    }

    if (!roadmap.projects.length) {
      console.log("No projects yet.");
      return;
    }

    console.log(`Projects (${roadmap.projects.length})`);
    roadmap.projects.forEach((projectRecord) => {
      const status = projectRecord.status || "active";
      console.log(
        `- ${projectRecord.name} (${status}) [${projectRecord.id || "no-id"}]`
      );
      if (projectRecord.description) {
        console.log(`  ${projectRecord.description}`);
      }
      if (projectRecord.owner) {
        console.log(`  Owner: ${projectRecord.owner}`);
      }

      const milestones = Array.isArray(projectRecord.milestones)
        ? projectRecord.milestones
        : [];
      console.log(`  Milestones: ${summarizeMilestones(milestones)}`);
    });
  });

project
  .command("update")
  .argument("<project>", "Project name or id")
  .option("--name <name>", "Update the project name")
  .option("-d, --description <text>", "Update the description")
  .option("-o, --owner <owner>", "Update the owner")
  .option(
    "-s, --status <status>",
    `Project status (${PROJECT_STATUSES.join(", ")})`
  )
  .description("Update a project")
  .action((projectRef, options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const updates = {};

    if (options.name) {
      const nextName = options.name.trim();
      const normalizedName = normalize(nextName);
      const conflict = roadmap.projects.find(
        (existing) =>
          existing !== projectRecord &&
          existing.name &&
          normalize(existing.name) === normalizedName
      );
      if (conflict) {
        exitWithError(`Project name "${nextName}" already exists.`);
      }
      updates.name = nextName;
    }

    if (options.description !== undefined) {
      updates.description = options.description.trim();
    }

    if (options.owner !== undefined) {
      updates.owner = options.owner.trim();
    }

    if (options.status) {
      updates.status = ensureValidStatus(
        options.status,
        PROJECT_STATUSES,
        "Project status"
      );
    }

    if (!Object.keys(updates).length) {
      exitWithError("No updates provided.");
    }

    Object.assign(projectRecord, updates);
    projectRecord.updatedAt = new Date().toISOString();
    saveRoadmap(filePath, roadmap);
    console.log(`Updated project "${projectRecord.name}".`);
  });

project
  .command("remove")
  .argument("<project>", "Project name or id")
  .description("Remove a project from the roadmap")
  .action((projectRef) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);
    const normalizedRef = normalize(projectRef);
    const index = roadmap.projects.findIndex(
      (projectRecord) =>
        (projectRecord.id &&
          normalize(projectRecord.id) === normalizedRef) ||
        (projectRecord.name &&
          normalize(projectRecord.name) === normalizedRef)
    );

    if (index === -1) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const [removed] = roadmap.projects.splice(index, 1);
    saveRoadmap(filePath, roadmap);
    console.log(`Removed project "${removed.name}".`);
  });

const milestone = program
  .command("milestone")
  .description("Manage milestones");

milestone
  .command("add")
  .argument("<project>", "Project name or id")
  .argument("<name>", "Milestone name")
  .option("-d, --description <text>", "Milestone description")
  .option("-o, --owner <owner>", "Owner or team")
  .option("--workload <value>", "Work allocation or effort notes")
  .option("--start <date>", "Start date (YYYY-MM-DD)")
  .option("--due <date>", "Due date (YYYY-MM-DD)")
  .option(
    "-s, --status <status>",
    `Milestone status (${MILESTONE_STATUSES.join(", ")})`,
    "planned"
  )
  .description("Add a milestone to a project")
  .action((projectRef, name, options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath, { createIfMissing: true });
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const normalizedName = normalize(name);
    if (
      (projectRecord.milestones || []).some(
        (existing) =>
          existing.name && normalize(existing.name) === normalizedName
      )
    ) {
      exitWithError(`Milestone "${name}" already exists for this project.`);
    }

    ensureValidDate(options.start, "Start date");
    ensureValidDate(options.due, "Due date");

    const status = ensureValidStatus(
      options.status,
      MILESTONE_STATUSES,
      "Milestone status"
    );

    const now = new Date().toISOString();
    const milestoneRecord = {
      id: generateId("ms", name),
      name,
      status,
      createdAt: now,
      updatedAt: now,
    };

    if (options.description) {
      milestoneRecord.description = options.description.trim();
    }

    if (options.owner) {
      milestoneRecord.owner = options.owner.trim();
    }

    if (options.workload) {
      milestoneRecord.workload = options.workload.trim();
    }

    if (options.start) {
      milestoneRecord.startDate = options.start;
    }

    if (options.due) {
      milestoneRecord.dueDate = options.due;
    }

    projectRecord.milestones = projectRecord.milestones || [];
    projectRecord.milestones.push(milestoneRecord);
    projectRecord.updatedAt = now;
    saveRoadmap(filePath, roadmap);
    console.log(`Added milestone "${name}" to "${projectRecord.name}".`);
  });

milestone
  .command("list")
  .argument("<project>", "Project name or id")
  .option("--status <status>", "Filter by status")
  .option("--json", "Output raw JSON")
  .description("List milestones for a project")
  .action((projectRef, options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    if (options.status) {
      ensureValidStatus(
        options.status,
        MILESTONE_STATUSES,
        "Milestone status"
      );
    }

    const milestones = Array.isArray(projectRecord.milestones)
      ? projectRecord.milestones
      : [];
    const filtered = options.status
      ? milestones.filter((milestoneRecord) => {
          const status = milestoneRecord.status || "planned";
          return status === options.status;
        })
      : milestones;

    if (options.json) {
      console.log(JSON.stringify(filtered, null, 2));
      return;
    }

    if (!filtered.length) {
      console.log(`No milestones for "${projectRecord.name}".`);
      return;
    }

    console.log(
      `Milestones for ${projectRecord.name} (${filtered.length})`
    );
    filtered.forEach((milestoneRecord) => {
      const status = milestoneRecord.status || "planned";
      console.log(
        `- ${milestoneRecord.name} (${status}) [${
          milestoneRecord.id || "no-id"
        }]`
      );
      if (milestoneRecord.description) {
        console.log(`  ${milestoneRecord.description}`);
      }

      const detailLine = buildDetailLine(
        [
          milestoneRecord.startDate
            ? `start ${milestoneRecord.startDate}`
            : null,
          milestoneRecord.dueDate ? `due ${milestoneRecord.dueDate}` : null,
          milestoneRecord.owner ? `owner ${milestoneRecord.owner}` : null,
          milestoneRecord.workload
            ? `workload ${milestoneRecord.workload}`
            : null,
        ].filter(Boolean)
      );

      if (detailLine) {
        console.log(`  ${detailLine}`);
      }
    });
  });

milestone
  .command("update")
  .argument("<project>", "Project name or id")
  .argument("<milestone>", "Milestone name or id")
  .option("--name <name>", "Update the milestone name")
  .option("-d, --description <text>", "Update the description")
  .option("-o, --owner <owner>", "Update the owner")
  .option("--workload <value>", "Update workload or effort notes")
  .option("--start <date>", "Start date (YYYY-MM-DD)")
  .option("--due <date>", "Due date (YYYY-MM-DD)")
  .option(
    "-s, --status <status>",
    `Milestone status (${MILESTONE_STATUSES.join(", ")})`
  )
  .description("Update a milestone")
  .action((projectRef, milestoneRef, options) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const milestoneRecord = findMilestone(projectRecord, milestoneRef);
    if (!milestoneRecord) {
      exitWithError(`Milestone "${milestoneRef}" not found.`);
    }

    const updates = {};

    if (options.name) {
      const nextName = options.name.trim();
      const normalizedName = normalize(nextName);
      const conflict = (projectRecord.milestones || []).find(
        (existing) =>
          existing !== milestoneRecord &&
          existing.name &&
          normalize(existing.name) === normalizedName
      );
      if (conflict) {
        exitWithError(`Milestone name "${nextName}" already exists.`);
      }
      updates.name = nextName;
    }

    if (options.description !== undefined) {
      updates.description = options.description.trim();
    }

    if (options.owner !== undefined) {
      updates.owner = options.owner.trim();
    }

    if (options.workload !== undefined) {
      updates.workload = options.workload.trim();
    }

    if (options.start !== undefined) {
      ensureValidDate(options.start, "Start date");
      updates.startDate = options.start;
    }

    if (options.due !== undefined) {
      ensureValidDate(options.due, "Due date");
      updates.dueDate = options.due;
    }

    if (options.status) {
      updates.status = ensureValidStatus(
        options.status,
        MILESTONE_STATUSES,
        "Milestone status"
      );
    }

    if (!Object.keys(updates).length) {
      exitWithError("No updates provided.");
    }

    Object.assign(milestoneRecord, updates);
    milestoneRecord.updatedAt = new Date().toISOString();
    projectRecord.updatedAt = milestoneRecord.updatedAt;
    saveRoadmap(filePath, roadmap);
    console.log(`Updated milestone "${milestoneRecord.name}".`);
  });

milestone
  .command("remove")
  .argument("<project>", "Project name or id")
  .argument("<milestone>", "Milestone name or id")
  .description("Remove a milestone from a project")
  .action((projectRef, milestoneRef) => {
    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath);
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const normalizedRef = normalize(milestoneRef);
    const milestones = projectRecord.milestones || [];
    const index = milestones.findIndex(
      (milestoneRecord) =>
        (milestoneRecord.id &&
          normalize(milestoneRecord.id) === normalizedRef) ||
        (milestoneRecord.name &&
          normalize(milestoneRecord.name) === normalizedRef)
    );

    if (index === -1) {
      exitWithError(`Milestone "${milestoneRef}" not found.`);
    }

    const [removed] = milestones.splice(index, 1);
    projectRecord.milestones = milestones;
    projectRecord.updatedAt = new Date().toISOString();
    saveRoadmap(filePath, roadmap);
    console.log(`Removed milestone "${removed.name}".`);
  });

program.parse(process.argv);
