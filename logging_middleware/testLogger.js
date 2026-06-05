const Log = require("./logger");

async function runTest() {
  const result = await Log("backend", "info", "handler", "first log test");
  console.log("API response:", result);

  await Log("backend", "info", "page", "this should be skipped");
}

runTest();
