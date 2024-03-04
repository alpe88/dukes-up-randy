// Parse the options into an array of objects
function parseOptions(value) {
  const options = value.split(",");
  return options.map((option) => {
    const [type, name] = option.split(":");
    console.log({ type, name });
    return { type, name };
  });
}

module.exports = {
  parseOptions,
};
