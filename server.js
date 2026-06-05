const express = require("express");
const axios = require("axios");

const getToken = require("./logging_middleware/auth");
const Log = require("./logging_middleware/logger");
const solveKnapsack = require("./vehicle_maintence_scheduler/knapsack");
const { computeTop10 } = require("./notification_app_be/priority");

require("dotenv").config();

const app = express();

async function fetchData(endpoint) {
  const token = await getToken();

  const response = await axios.get(
    process.env.BASE_URL + endpoint,
    {
      headers: {
        Authorization: "Bearer " + token
      }
    }
  );

  return response.data;
}

app.get("/api/scheduler", async (req, res) => {
  try {
    await Log("backend", "info", "route", "GET /api/scheduler");

    const depotsData = await fetchData("/depots");
    const depots = depotsData.depots;

    let totalMechanicHours = 0;

    for (const depot of depots) {
      totalMechanicHours += depot.MechanicHours;
    }

    const vehiclesData = await fetchData("/vehicles");
    const vehicles = vehiclesData.vehicles;

    const result = solveKnapsack(
      vehicles,
      totalMechanicHours
    );

    res.json({
      totalMechanicHours: totalMechanicHours,
      selectedVehicleCount: result.selected.length,
      totalImpactAchieved: result.totalImpact,
      totalMechanicHoursUsed: result.totalDuration,
      selectedVehicles: result.selected
    });
  } catch (error) {
    const reason = error.response
      ? error.response.data
      : error.message;

    await Log(
      "backend",
      "error",
      "route",
      "GET /api/scheduler failed: " +
        JSON.stringify(reason)
    );

    res.status(500).json({
      error: reason
    });
  }
});

app.get("/api/inbox", async (req, res) => {
  try {
    await Log("backend", "info", "route", "GET /api/inbox");

    const data = await fetchData("/notifications");

    res.json({
      notifications: data.notifications
    });
  } catch (error) {
    const reason = error.response
      ? error.response.data
      : error.message;

    await Log(
      "backend",
      "error",
      "route",
      "GET /api/inbox failed: " +
        JSON.stringify(reason)
    );

    res.status(500).json({
      error: reason
    });
  }
});

app.get("/api/priority", async (req, res) => {
  try {
    await Log("backend", "info", "route", "GET /api/priority");

    const data = await fetchData("/notifications");

    const top10 = computeTop10(
      data.notifications
    );

    res.json({
      top10: top10
    });
  } catch (error) {
    const reason = error.response
      ? error.response.data
      : error.message;

    await Log(
      "backend",
      "error",
      "route",
      "GET /api/priority failed: " +
        JSON.stringify(reason)
    );

    res.status(500).json({
      error: reason
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    "Server running on http://localhost:" + PORT
  );
});