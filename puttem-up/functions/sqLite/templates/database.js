const Database = require("better-sqlite3");
const path = require("path");

// Function to initialize the database and return the instance
function initialize() {
  // Define the path to your database file
  const dbPath = path.join(__dirname, "{{DATABASE_FILE_PATH}}");

  // Create and configure the database instance
  const db = new Database(dbPath, {
    /* database configuration options */
    verbose: console.log, // Optional: enable verbose mode
  });

  // Create tables and perform other database setup here

  return db;
}

function createUserTables(db) {
  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    email TEXT
  )
`
  ).run();
}

// Function to seed the database with initial data
function seedUserTables(db) {
  // Define your user data here
  const users = [
    { username: "User1", email: "user1@example.com" },
    { username: "User2", email: "user2@example.com" },
    // Add more users as needed
  ];

  // Prepare the insert statement
  const insert = db.prepare(
    "INSERT INTO users (username, email) VALUES (@username, @email)"
  );

  // Use a transaction to insert multiple users
  const insertMany = db.transaction((users) => {
    for (const user of users) insert.run(user);
  });

  // Execute the transaction to insert the users
  insertMany(users);
}

module.exports = { initialize, createUserTables, seedUserTables };
