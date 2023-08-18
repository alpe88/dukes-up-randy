// Parse the frontends option into an array of objects
function parseFrontends(value) {
  const frontends = value.split(",");
  return frontends.map((frontend) => {
    const [type, name] = frontend.split(":");
    return { type, name };
  });
}

// Parse the databases option into an array of objects
function parseDatabases(value) {
  const databases = value.split(",");
  return databases.map((database) => {
    const [type, name] = database.split(":");
    return { type, name };
  });
}

module.exports = {
  parseFrontends,
  parseDatabases,
};
