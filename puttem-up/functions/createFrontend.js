#!/usr/bin/env node

const mkdirp = require("mkdirp");
const path = require("path");
const { execSync } = require("child_process");
const { DIRECTORIES } = require("../_lib/constants");

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
    vuets: "vue-ts",
    reactts: "react-ts",
    preactts: "preact-ts",
    nextjs: "nextjs",
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

    const command =
      templatePreset === supportedFrontends.nextjs
        ? `npx create-next-app@latest ${projectName}`
        : `npm create vite@latest . -- --template ${templatePreset}`;

    execSync(`cd ${frontendDir} && ${command}`, { stdio: "inherit" });
  });

  console.log("Folder structure created successfully.");
}

module.exports = {
  createFrontend,
};
