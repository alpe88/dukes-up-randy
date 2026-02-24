const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function generateDatabaseFile(databaseDir) {
  // Define the template file path
  const templatePath = path.join(__dirname, "templates", "database.js");

  // Read the template file content
  const templateContent = fs.readFileSync(templatePath, "utf-8");

  // Define the path for the generated database.js file
  const scriptFile = path.join(databaseDir, "database.js");
  const databaseFile = path.join(databaseDir, "my-database.db");

  console.log({
    databaseDir,
    templatePath,
    scriptFile,
  });

  // Replace placeholders with actual values
  const scriptContent = templateContent.replace(
    "{{DATABASE_FILE_PATH}}",
    databaseFile
  );

  // Write the generated content to the new database.js file
  fs.writeFileSync(scriptFile, scriptContent, "utf-8");

  console.log("Generated database.js file.");
}

function install(databaseDir) {
  execSync(`cd ${databaseDir} && npm install better-sqlite3 --save-dev`, {
    stdio: "inherit",
  });
  console.log(`better-sqlite3 installed in ${databaseDir}`);
}

function setup(databaseDir) {
  install(databaseDir);
  generateDatabaseFile(databaseDir);
}

module.exports = { setup };
