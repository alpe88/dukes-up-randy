const fs = require("fs");
const path = require("path");

const DEFAULT_DATA_FILE = "gitter-done.json";
const PROJECT_STATUSES = ["planned", "active", "paused", "completed"];
const MILESTONE_STATUSES = ["planned", "in-progress", "blocked", "completed"];

function resolveDataFile(filePath) {
  const resolved = filePath || process.env.GITTER_DONE_FILE || DEFAULT_DATA_FILE;
  return path.isAbsolute(resolved)
    ? resolved
    : path.resolve(process.cwd(), resolved);
}

function createEmptyRoadmap() {
  const now = new Date().toISOString();
  return {
    meta: {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    },
    projects: [],
  };
}

function ensureRoadmapShape(roadmap) {
  if (!roadmap.projects || !Array.isArray(roadmap.projects)) {
    roadmap.projects = [];
  }

  if (!roadmap.meta || typeof roadmap.meta !== "object") {
    roadmap.meta = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  roadmap.meta.schemaVersion = roadmap.meta.schemaVersion || 1;
  roadmap.meta.createdAt = roadmap.meta.createdAt || new Date().toISOString();
  roadmap.meta.updatedAt = roadmap.meta.updatedAt || roadmap.meta.createdAt;
}

function loadRoadmap(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) {
    return createEmptyRoadmap();
  }

  try {
    const data = JSON.parse(raw);
    ensureRoadmapShape(data);
    return data;
  } catch (error) {
    throw new Error(`Unable to parse JSON in ${filePath}: ${error.message}`);
  }
}

function saveRoadmap(filePath, roadmap) {
  const now = new Date().toISOString();

  if (!roadmap.meta || typeof roadmap.meta !== "object") {
    roadmap.meta = {
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  roadmap.meta.schemaVersion = roadmap.meta.schemaVersion || 1;
  roadmap.meta.createdAt = roadmap.meta.createdAt || now;
  roadmap.meta.updatedAt = now;

  const directory = path.dirname(filePath);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(roadmap, null, 2));
}

function normalize(value) {
  return value.trim().toLowerCase();
}

function slugify(value) {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateId(prefix, name) {
  const slug = slugify(name) || "item";
  const entropy = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${slug}-${entropy}`;
}

function findProject(roadmap, projectRef) {
  const needle = normalize(projectRef);
  return roadmap.projects.find((project) => {
    const projectId = project.id ? normalize(project.id) : "";
    const projectName = project.name ? normalize(project.name) : "";
    return projectId === needle || projectName === needle;
  });
}

function findMilestone(project, milestoneRef) {
  const needle = normalize(milestoneRef);
  return (project.milestones || []).find((milestone) => {
    const milestoneId = milestone.id ? normalize(milestone.id) : "";
    const milestoneName = milestone.name ? normalize(milestone.name) : "";
    return milestoneId === needle || milestoneName === needle;
  });
}

function isValidDate(value) {
  if (!value) {
    return false;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().startsWith(value);
}

module.exports = {
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
};
