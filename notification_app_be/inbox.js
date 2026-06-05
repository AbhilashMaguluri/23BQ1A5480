const axios = require("axios");

const getToken = require("../logging_middleware/auth");
const Log = require("../logging_middleware/logger");
const { computeTop10 } = require("./priority");

require("dotenv").config();

async function fetchNotifications() {
  const token = await getToken();
  const url = process.env.BASE_URL + "/notifications";
  const response = await axios.get(url, {
    headers: { Authorization: "Bearer " + token },
  });
  return response.data.notifications;
}

async function run() {
  await Log("backend", "info", "service", "Priority inbox started");

  const notifications = await fetchNotifications();
  await Log("backend", "info", "service", "Fetched " + notifications.length + " notifications");

  const top10 = computeTop10(notifications);
  await Log("backend", "info", "service", "Computed top " + top10.length + " notifications");

  console.log("Top 10 notifications (Placement > Result > Event, newest first):\n");
  top10.forEach(function (item, index) {
    console.log((index + 1) + ". [" + item.Type + "] " + item.Message + " (" + item.Timestamp + ")");
  });
}

run().catch(async (error) => {
  const reason = error.response ? error.response.data : error.message;
  await Log("backend", "error", "service", "Priority inbox failed: " + JSON.stringify(reason));
  console.error("Priority inbox failed:", reason);
});
