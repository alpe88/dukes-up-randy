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
    const { name, folder } = frontend;
    const frontendDir = path.join(projectDir, folder);

    mkdirp.sync(frontendDir);

    // Execute Vite setup with template presets
    const templatePreset = supportedFrontends[name];
    if (!templatePreset) {
      console.error(`Unsupported frontend: ${name}`);
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
