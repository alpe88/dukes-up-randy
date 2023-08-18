const { execSync } = require("child_process");

function install(databaseDir) {
  execSync(`cd ${databaseDir} && npm install better-sqlite3`, {
    stdio: "inherit",
  });
  console.log(`better-sqlite3 installed in ${databaseDir}`);
}

function setup(databaseDir) {
  install(databaseDir);
}

module.exports = { setup };
