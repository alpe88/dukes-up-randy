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
const {
  CONFIG_FILE,
  getGitHubToken,
  setGitHubToken,
  getGitHubOrg,
  setGitHubOrg,
  getConfig,
  clearConfig,
} = require("./lib/config");
const github = require("./lib/github");

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      exitWithError("Project name cannot be empty or whitespace-only.");
    }

    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath, { createIfMissing: true });
    const normalizedName = normalize(trimmedName);

    if (
      roadmap.projects.some(
        (existing) => existing.name && normalize(existing.name) === normalizedName
      )
    ) {
      exitWithError(`Project "${trimmedName}" already exists.`);
    }

    const status = ensureValidStatus(
      options.status,
      PROJECT_STATUSES,
      "Project status"
    );

    const now = new Date().toISOString();
    const projectRecord = {
      id: generateId("proj", trimmedName),
      name: trimmedName,
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
    console.log(`Added project "${trimmedName}".`);
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

    if (options.name !== undefined) {
      const nextName = options.name.trim();
      if (!nextName) {
        exitWithError("Project name cannot be empty or whitespace-only.");
      }
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
    const trimmedName = name.trim();
    if (!trimmedName) {
      exitWithError("Milestone name cannot be empty or whitespace-only.");
    }

    const filePath = getFilePath();
    const roadmap = getRoadmap(filePath, { createIfMissing: true });
    const projectRecord = findProject(roadmap, projectRef);

    if (!projectRecord) {
      exitWithError(`Project "${projectRef}" not found.`);
    }

    const normalizedName = normalize(trimmedName);
    if (
      (projectRecord.milestones || []).some(
        (existing) =>
          existing.name && normalize(existing.name) === normalizedName
      )
    ) {
      exitWithError(`Milestone "${trimmedName}" already exists for this project.`);
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
      id: generateId("ms", trimmedName),
      name: trimmedName,
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
    console.log(`Added milestone "${trimmedName}" to "${projectRecord.name}".`);
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

    if (options.name !== undefined) {
      const nextName = options.name.trim();
      if (!nextName) {
        exitWithError("Milestone name cannot be empty or whitespace-only.");
      }
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
      if (options.start === "") {
        updates.startDate = "";
      } else {
        ensureValidDate(options.start, "Start date");
        updates.startDate = options.start;
      }
    }

    if (options.due !== undefined) {
      if (options.due === "") {
        updates.dueDate = "";
      } else {
        ensureValidDate(options.due, "Due date");
        updates.dueDate = options.due;
      }
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

// ==================== GitHub Commands ====================

const gh = program.command("github").description("GitHub integration commands");

gh.command("config")
  .description("Configure GitHub credentials")
  .option("--token <token>", "GitHub personal access token")
  .option("--org <org>", "GitHub organization name")
  .option("--show", "Show current configuration")
  .option("--clear", "Clear stored configuration")
  .action((options) => {
    if (options.clear) {
      clearConfig();
      console.log("Configuration cleared.");
      return;
    }

    if (options.show) {
      const token = getGitHubToken();
      const org = getGitHubOrg();
      console.log(`Config file: ${CONFIG_FILE}`);
      console.log(`Token: ${token ? `${token.slice(0, 8)}...` : "(not set)"}`);
      console.log(`Organization: ${org || "(not set)"}`);
      return;
    }

    if (options.token) {
      setGitHubToken(options.token);
      console.log("GitHub token saved.");
    }

    if (options.org) {
      setGitHubOrg(options.org);
      console.log(`GitHub organization set to "${options.org}".`);
    }

    if (!options.token && !options.org) {
      console.log("Usage: gitter-done github config --token <token> --org <org>");
      console.log("       gitter-done github config --show");
    }
  });

// GitHub Repos
const ghRepo = gh.command("repo").description("Manage GitHub repositories");

ghRepo
  .command("list")
  .option("--org <org>", "Organization (uses configured org if not specified)")
  .option("--json", "Output raw JSON")
  .description("List repositories in the organization")
  .action(async (options) => {
    try {
      const org = options.org || github.requireOrg();
      const repos = await github.listRepos(org);

      if (options.json) {
        console.log(JSON.stringify(repos, null, 2));
        return;
      }

      console.log(`Repositories in ${org} (${repos.length})`);
      repos.forEach((repo) => {
        const visibility = repo.private ? "private" : "public";
        console.log(`- ${repo.name} (${visibility})`);
        if (repo.description) {
          console.log(`  ${repo.description}`);
        }
      });
    } catch (error) {
      exitWithError(error.message);
    }
  });

// GitHub Projects (V2)
const ghProject = gh.command("project").description("Manage GitHub Projects");

ghProject
  .command("list")
  .option("--org <org>", "Organization (uses configured org if not specified)")
  .option("--json", "Output raw JSON")
  .description("List GitHub Projects in the organization")
  .action(async (options) => {
    try {
      const org = options.org || github.requireOrg();
      const projects = await github.listProjects(org);

      if (options.json) {
        console.log(JSON.stringify(projects, null, 2));
        return;
      }

      if (!projects.length) {
        console.log(`No projects found in ${org}.`);
        return;
      }

      console.log(`Projects in ${org} (${projects.length})`);
      projects.forEach((proj) => {
        const status = proj.closed ? "closed" : "open";
        console.log(`- #${proj.number}: ${proj.title} (${status})`);
        if (proj.shortDescription) {
          console.log(`  ${proj.shortDescription}`);
        }
        console.log(`  ${proj.url}`);
      });
    } catch (error) {
      exitWithError(error.message);
    }
  });

ghProject
  .command("create")
  .argument("<title>", "Project title")
  .option("-d, --description <text>", "Project description")
  .option("--org <org>", "Organization (uses configured org if not specified)")
  .description("Create a new GitHub Project")
  .action(async (title, options) => {
    try {
      const org = options.org || github.requireOrg();
      const project = await github.createProject(org, {
        title,
        description: options.description,
      });

      console.log(`Created project "${project.title}" (#${project.number})`);
      console.log(`URL: ${project.url}`);
    } catch (error) {
      exitWithError(error.message);
    }
  });

ghProject
  .command("show")
  .argument("<number>", "Project number")
  .option("--org <org>", "Organization (uses configured org if not specified)")
  .option("--json", "Output raw JSON")
  .description("Show details of a GitHub Project")
  .action(async (number, options) => {
    try {
      const org = options.org || github.requireOrg();
      const project = await github.getProject(org, parseInt(number, 10));

      if (options.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }

      const status = project.closed ? "closed" : "open";
      console.log(`Project #${project.number}: ${project.title} (${status})`);
      if (project.shortDescription) {
        console.log(`Description: ${project.shortDescription}`);
      }
      console.log(`URL: ${project.url}`);

      const items = project.items?.nodes || [];
      const issues = items.filter((item) => item.content);
      if (issues.length) {
        console.log(`\nItems (${issues.length}):`);
        issues.forEach((item) => {
          const content = item.content;
          console.log(
            `- ${content.repository?.name}#${content.number}: ${content.title} (${content.state})`
          );
        });
      } else {
        console.log("\nNo items in project.");
      }
    } catch (error) {
      exitWithError(error.message);
    }
  });

// GitHub Issues
const ghIssue = gh.command("issue").description("Manage GitHub Issues");

ghIssue
  .command("list")
  .argument("<repo>", "Repository name (org/repo or just repo if org is configured)")
  .option("--state <state>", "Filter by state (open, closed, all)", "open")
  .option("--json", "Output raw JSON")
  .description("List issues in a repository")
  .action(async (repo, options) => {
    try {
      const [owner, repoName] = repo.includes("/")
        ? repo.split("/")
        : [github.requireOrg(), repo];

      const issues = await github.listIssues(owner, repoName, {
        state: options.state,
      });

      if (options.json) {
        console.log(JSON.stringify(issues, null, 2));
        return;
      }

      if (!issues.length) {
        console.log(`No ${options.state} issues in ${owner}/${repoName}.`);
        return;
      }

      console.log(`Issues in ${owner}/${repoName} (${issues.length})`);
      issues.forEach((issue) => {
        const labels = issue.labels.map((l) => l.name).join(", ");
        console.log(`- #${issue.number}: ${issue.title} (${issue.state})`);
        if (labels) {
          console.log(`  Labels: ${labels}`);
        }
        if (issue.milestone) {
          console.log(`  Milestone: ${issue.milestone.title}`);
        }
      });
    } catch (error) {
      exitWithError(error.message);
    }
  });

ghIssue
  .command("create")
  .argument("<repo>", "Repository name (org/repo or just repo if org is configured)")
  .argument("<title>", "Issue title")
  .option("-b, --body <text>", "Issue body/description")
  .option("-l, --labels <labels...>", "Labels to apply")
  .option("-m, --milestone <number>", "Milestone number")
  .option("-a, --assignees <users...>", "Assignees")
  .description("Create a new issue")
  .action(async (repo, title, options) => {
    try {
      const [owner, repoName] = repo.includes("/")
        ? repo.split("/")
        : [github.requireOrg(), repo];

      const issue = await github.createIssue(owner, repoName, {
        title,
        body: options.body,
        labels: options.labels,
        milestone: options.milestone ? parseInt(options.milestone, 10) : undefined,
        assignees: options.assignees,
      });

      console.log(`Created issue #${issue.number}: ${issue.title}`);
      console.log(`URL: ${issue.html_url}`);
    } catch (error) {
      exitWithError(error.message);
    }
  });

ghIssue
  .command("add-to-project")
  .argument("<repo>", "Repository (org/repo or just repo)")
  .argument("<issue>", "Issue number")
  .argument("<project>", "Project number")
  .option("--org <org>", "Organization for the project")
  .description("Add an issue to a GitHub Project")
  .action(async (repo, issueNumber, projectNumber, options) => {
    try {
      const [owner, repoName] = repo.includes("/")
        ? repo.split("/")
        : [github.requireOrg(), repo];

      const org = options.org || github.requireOrg();

      // Get project ID
      const project = await github.getProject(org, parseInt(projectNumber, 10));

      // Get issue node ID
      const issueNodeId = await github.getIssueNodeId(
        owner,
        repoName,
        parseInt(issueNumber, 10)
      );

      // Add to project
      await github.addIssueToProject(project.id, issueNodeId);

      console.log(
        `Added ${owner}/${repoName}#${issueNumber} to project "${project.title}"`
      );
    } catch (error) {
      exitWithError(error.message);
    }
  });

// GitHub Milestones (repo-level)
const ghMilestone = gh.command("milestone").description("Manage GitHub Milestones");

ghMilestone
  .command("list")
  .argument("<repo>", "Repository name (org/repo or just repo)")
  .option("--json", "Output raw JSON")
  .description("List milestones in a repository")
  .action(async (repo, options) => {
    try {
      const [owner, repoName] = repo.includes("/")
        ? repo.split("/")
        : [github.requireOrg(), repo];

      const milestones = await github.listMilestones(owner, repoName);

      if (options.json) {
        console.log(JSON.stringify(milestones, null, 2));
        return;
      }

      if (!milestones.length) {
        console.log(`No milestones in ${owner}/${repoName}.`);
        return;
      }

      console.log(`Milestones in ${owner}/${repoName} (${milestones.length})`);
      milestones.forEach((ms) => {
        console.log(`- #${ms.number}: ${ms.title} (${ms.state})`);
        if (ms.description) {
          console.log(`  ${ms.description}`);
        }
        if (ms.due_on) {
          console.log(`  Due: ${ms.due_on.split("T")[0]}`);
        }
        console.log(
          `  Issues: ${ms.open_issues} open, ${ms.closed_issues} closed`
        );
      });
    } catch (error) {
      exitWithError(error.message);
    }
  });

ghMilestone
  .command("create")
  .argument("<repo>", "Repository name (org/repo or just repo)")
  .argument("<title>", "Milestone title")
  .option("-d, --description <text>", "Milestone description")
  .option("--due <date>", "Due date (YYYY-MM-DD)")
  .description("Create a milestone in a repository")
  .action(async (repo, title, options) => {
    try {
      const [owner, repoName] = repo.includes("/")
        ? repo.split("/")
        : [github.requireOrg(), repo];

      if (options.due) {
        ensureValidDate(options.due, "Due date");
      }

      const ms = await github.createMilestone(owner, repoName, {
        title,
        description: options.description,
        dueDate: options.due,
      });

      console.log(`Created milestone #${ms.number}: ${ms.title}`);
      console.log(`URL: ${ms.html_url}`);
    } catch (error) {
      exitWithError(error.message);
    }
  });

program.parse(process.argv);
