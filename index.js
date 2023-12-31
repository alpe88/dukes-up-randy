#!/usr/bin/env node

const { program } = require("commander");
const { parseOptions } = require("./utils");
const { createFrontend } = require("./functions/createFrontend");
const { createBackend } = require("./functions/createBackend");

program
  .name("dukes-up-randy")
  .version("0.0.3")
  .description(
    "Create a folder structure for a project with multiple frontends and databases"
  );

program
  .command("create")
  .requiredOption(
    "-n, --project-name <project-name>",
    "Specify the name of the project",
    "my-project"
  )
  .option("-p, --path <path>", "Specify the path to create the project")
  .option(
    "-f, --frontends <frontends...>",
    "Specify the frontends: vue:my-vue, react:my-react",
    parseOptions
  )
  .option(
    "-d, --databases <databases...>",
    "Specify the databases: postgresql:my-postgres, mongo:my-mongo, sqlite:my-sqlite",
    parseOptions
  )
  .description("Create folder structure for frontend, backend, or both")
  .action((options) => {
    const { frontends, databases, projectName, path } = options;
    console.log("options: ", {
      frontends,
      databases,
      projectName,
      path,
    });

    if (!frontends && !databases && !path) {
      console.error(
        "No valid options provided. Please specify frontends, databases, or both."
      );
    }

    const basePath = path ? path : process.cwd();
    console.log({ basePath });
    if (frontends) {
      createFrontend({ frontends, projectName, basePath });
    }

    if (databases) {
      createBackend({ databases, projectName, basePath });
    }
  });

program.parse(process.argv);
