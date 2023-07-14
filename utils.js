// Parse the frontends option into an array of objects
function parseFrontends(value) {
  const frontends = value.split(",");
  return frontends.map((frontend) => {
    const [name, folder] = frontend.split(":");
    return { name, folder };
  });
}

// Parse the databases option into an array of objects
function parseDatabases(value) {
  const databases = value.split(",");
  return databases.map((database) => {
    const [name, alias] = database.split(":");
    return { name, alias };
  });
}

module.exports = {
  parseFrontends,
  parseDatabases,
};
