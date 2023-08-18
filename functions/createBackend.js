#!/usr/bin/env node

const mkdirp = require("mkdirp");
const path = require("path");
const { DIRECTORIES } = require("../constants");
const { setup: sqliteSetup } = require("./sqLite");

function createBackend({ databases, projectName, basePath }) {
  const projectDir = path.join(basePath, projectName, DIRECTORIES.BACKEND);

  // Create directories
  mkdirp.sync(projectDir, {
    recursive: true,
  });

  // Supported backends and their template presets
  const supportedBackends = {
    postgresql: "postgresql",
    mongo: "mongo",
    sqlite: "sqlite",
  };

  //Create subfolders for databases
  databases.forEach((database) => {
    const { type, name } = database;
    const databaseDir = path.join(projectDir, name);

    // Create directories
    mkdirp.sync(databaseDir, {
      recursive: true,
    });

    const templatePreset = supportedBackends[type];
    if (!templatePreset) {
      console.error(`Unsupported backend: ${type}`);
    }

    if (templatePreset === supportedBackends.sqlite) {
      sqliteSetup(databaseDir);
    } else {
      console.warn(`Support for ${templatePreset} pending...`);
    }
  });
}

module.exports = { createBackend };
