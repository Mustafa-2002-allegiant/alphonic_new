const fetch = require("node-fetch");
const qs = require("querystring");

const BASE_URL = "https://138.201.82.40/agc/api.php";
const API_USER = "admin";             // Replace with actual VICIdial API user
const API_PASS = "1234";              // Your admin API password
const SOURCE = "botapi";
const CAMPAIGN = "001";               // Replace if dynamic

async function callVicidialAPI(params) {
  const body = qs.stringify({
    user: API_USER,
    pass: API_PASS,
    source: SOURCE,
    ...params
  });

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await res.text();
  console.log(`📡 VICIdial ${params.function} →`, text);
  return text;
}

module.exports = {
  // 🔹 Manual call from bot to agent (calls extension 8600051)
  callAgent: (agent_user) =>
    callVicidialAPI({
      function: "external_dial",
      agent_user,
      session_user: agent_user,
      phone_code: "1",
      number_to_dial: "8600051",
      campaign: CAMPAIGN,
      search: "NO",
      preview: "NO",
      focus: "YES",
      format: "text"
    }),

  // 🔹 Check agent's recording status
  getRecordingStatus: (agent_user) =>
    callVicidialAPI({
      function: "recording",
      agent_user,
      session_user: agent_user,
      value: "STATUS"
    }),

  // 🔹 Hang up agent call
  hangupCall: (agent_user) =>
    callVicidialAPI({
      function: "external_hangup",
      agent_user,
      session_user: agent_user,
      value: "1"
    }),

  // 🔹 Set agent to paused
  pauseAgent: (agent_user) =>
    callVicidialAPI({
      function: "external_pause",
      agent_user,
      session_user: agent_user,
      value: "PAUSE"
    }),

  // 🔹 Set agent status
  setStatus: (agent_user, status) =>
    callVicidialAPI({
      function: "external_status",
      agent_user,
      session_user: agent_user,
      value: status
    }),

  // 🔹 Transfer bot call to real agent
  transferCall: (agent_user, phone_number = "8600051") =>
    callVicidialAPI({
      function: "transfer_conference",
      agent_user,
      session_user: agent_user,
      value: "DIAL_WITH_CUSTOMER", // Required to bridge
      phone_number
    }),
  
};
