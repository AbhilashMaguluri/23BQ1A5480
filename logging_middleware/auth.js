const axios = require("axios");
require("dotenv").config();

let cachedToken = null;
let tokenExpiryEpoch = 0; 

async function getToken() {
  const nowInSeconds = Math.floor(Date.now() / 1000);

 
  if (cachedToken && nowInSeconds < tokenExpiryEpoch - 60) {
    return cachedToken;
  }

  const authUrl = process.env.BASE_URL + "/auth";

  const body = {
    email: process.env.EMAIL,
    name: process.env.NAME,
    rollNo: process.env.ROLL_NO,
    accessCode: process.env.ACCESS_CODE,
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  };

  const response = await axios.post(authUrl, body);

  cachedToken = response.data.access_token;
  tokenExpiryEpoch = response.data.expires_in || nowInSeconds + 600;

  return cachedToken;
}

module.exports = getToken;
