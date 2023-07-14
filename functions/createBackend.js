const mkdirp = require("mkdirp");
const path = require("path");

function createBackend({ databases, projectName, basePath }) {
  const basePath = projectPath || process.cwd();
  const projectDir = path.join(basePath, projectName);

  mkdirp.sync(projectDir);

  console.log("backend still needs work...", {
    databases,
    projectName,
    projectPath,
  });

  // Supported databases and their setup logic
  // const supportedDatabases = {
  //   postgresql: {
  //     setup: () => {
  //       console.log("Setting up PostgreSQL database...");
  //       // Additional logic for setting up PostgreSQL
  //     },
  //   },
  //   mongo: {
  //     setup: () => {
  //       console.log("Setting up MongoDB database...");
  //       // Additional logic for setting up MongoDB
  //     },
  //   },
  //   sqlite: {
  //     setup: () => {
  //       console.log("Setting up SQLite database...");
  //       // Additional logic for setting up SQLite
  //     },
  //   },
  // };

  // databases.forEach((databaseObj) => {
  //   const { name, alias } = databaseObj;
  //   const dbSetup = supportedDatabases[name];
  //   if (dbSetup) {
  //     dbSetup.setup(alias);
  //   } else {
  //     console.error(`Unsupported database: ${name}`);
  //   }
  // });
}

module.exports = createBackend;
