const axios = require("axios");
const fs = require("fs");
const path = require("path");

const getToken = require("../logging_middleware/auth");
const Log = require("../logging_middleware/logger");
const solveKnapsack = require("./knapsack");

require("dotenv").config();

async function fetchData(endpoint) {
  const token = await getToken();
  const url = process.env.BASE_URL + endpoint;
  const response = await axios.get(url, {
    headers: { Authorization: "Bearer " + token },
  });
  return response.data;
}

async function run() {
  await Log("backend", "info", "service", "Vehicle scheduler started");

  const depotsData = await fetchData("/depots");
  const depots = depotsData.depots;

  let totalMechanicHours = 0;
  for (const depot of depots) {
    totalMechanicHours += depot.MechanicHours;
  }
  await Log("backend", "info", "service", "Fetched " + depots.length + " depots, total mechanic hours = " + totalMechanicHours);

  const vehiclesData = await fetchData("/vehicles");
  const vehicles = vehiclesData.vehicles;
  await Log("backend", "info", "service", "Fetched " + vehicles.length + " vehicles");

  const result = solveKnapsack(vehicles, totalMechanicHours);
  await Log("backend", "info", "service", "Selected " + result.selected.length + " vehicles, total impact = " + result.totalImpact);

  const output = {
    totalMechanicHours: totalMechanicHours,
    selectedVehicleCount: result.selected.length,
    totalImpactAchieved: result.totalImpact,
    totalMechanicHoursUsed: result.totalDuration,
    selectedVehicles: result.selected,
  };

  console.log(JSON.stringify(output, null, 2));

  const outputPath = path.join(__dirname, "result.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log("\nSaved output to:", outputPath);
}

run().catch(async (error) => {
  const reason = error.response ? error.response.data : error.message;
  await Log("backend", "error", "service", "Scheduler failed: " + JSON.stringify(reason));
  console.error("Scheduler failed:", reason);
});
