const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".gitter-done");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  ensureConfigDir();
  
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getGitHubToken() {
  // Check environment variable first
  if (process.env.GITHUB_TOKEN) {
    return process.env.GITHUB_TOKEN;
  }
  
  const config = loadConfig();
  return config.githubToken || null;
}

function setGitHubToken(token) {
  const config = loadConfig();
  config.githubToken = token;
  saveConfig(config);
}

function getGitHubOrg() {
  if (process.env.GITHUB_ORG) {
    return process.env.GITHUB_ORG;
  }
  
  const config = loadConfig();
  return config.githubOrg || null;
}

function setGitHubOrg(org) {
  const config = loadConfig();
  config.githubOrg = org;
  saveConfig(config);
}

function getConfig() {
  return loadConfig();
}

function clearConfig() {
  saveConfig({});
}

module.exports = {
  CONFIG_FILE,
  loadConfig,
  saveConfig,
  getGitHubToken,
  setGitHubToken,
  getGitHubOrg,
  setGitHubOrg,
  getConfig,
  clearConfig,
};
