#!/usr/bin/env node

const mkdirp = require("mkdirp");
const path = require("path");
const { execSync } = require("child_process");
const { DIRECTORIES } = require("../constants");

function createFrontend({ frontends, projectName, basePath }) {
  const projectDir = path.join(basePath, projectName, DIRECTORIES.FRONTEND);

  // Create directories
  mkdirp.sync(projectDir, {
    recursive: true,
  });

  // Supported frontends and their template presets
  const supportedFrontends = {
    vue: "vue",
    react: "react",
    preact: "preact",
  };

  //Create subfolders for frontends
  frontends.forEach((frontend) => {
    const { type, name } = frontend;
    const frontendDir = path.join(projectDir, name);

    // Create directories
    mkdirp.sync(frontendDir, {
      recursive: true,
    });

    // Execute Vite setup with template presets
    const templatePreset = supportedFrontends[type];
    if (!templatePreset) {
      console.error(`Unsupported frontend: ${type}`);
    }

    execSync(
      `cd ${frontendDir} && npm create vite@latest . -- --template ${templatePreset}`,
      { stdio: "inherit" }
    );
  });

  console.log("Folder structure created successfully.");
}

module.exports = {
  createFrontend,
};
