const axios = require("axios");
const getToken = require("./auth"); 
require("dotenv").config(); 
const validStacks = ["backend", "frontend"];

const validLevels = ["debug", "info", "warn", "error", "fatal"];

const backendPackages = [
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
];


const frontendPackages = ["api", "component", "hook", "page", "state", "style"];

const commonPackages = ["auth", "config", "middleware", "utils"];

function getAllowedPackages(stack) {
  if (stack === "backend") {
    return backendPackages.concat(commonPackages);
  }
  if (stack === "frontend") {
    return frontendPackages.concat(commonPackages);
  }
  return [];
}

async function Log(stack, level, packageName, message) {
  if (!validStacks.includes(stack)) {
    console.warn("Log skipped: invalid stack ->", stack);
    return;
  }

  if (!validLevels.includes(level)) {
    console.warn("Log skipped: invalid level ->", level);
    return;
  }

  const allowedPackages = getAllowedPackages(stack);
  if (!allowedPackages.includes(packageName)) {
    console.warn("Log skipped: invalid package for", stack, "->", packageName);
    return;
  }

  const body = {
    stack: stack,
    level: level,
    package: packageName,
    message: message,
  };


  try {
    const token = await getToken();
    const logsUrl = process.env.BASE_URL + "/logs";

    const response = await axios.post(logsUrl, body, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

  
    return response.data;
  } catch (error) {
  
    const reason = error.response ? error.response.data : error.message;
    console.warn("Log failed:", reason);
  }
}

module.exports = Log;
