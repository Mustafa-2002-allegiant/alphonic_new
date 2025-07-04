// vicidialApiClient.js
const fetch = require("node-fetch");
const qs = require("querystring");

const VICIDIAL_BASE = "https://138.201.82.40/agc/api.php";
const USER = "9999";
const PASS = "i6yhtrhgfh";
const SOURCE = "bot-api";

async function callVicidialAPI(params) {
  const body = qs.stringify({
    ...params,
    user: USER,
    pass: PASS,
    source: SOURCE
  });

  const res = await fetch(VICIDIAL_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await res.text();
  console.log(`[📡 VICIdial API] ${params.function}:`, text);
  return text;
}

module.exports = {
  callAgent: (agent_user) =>
    callVicidialAPI({ function: "call_agent", agent_user, value: "CALL" }),
  getRecordingStatus: (agent_user) =>
    callVicidialAPI({ function: "recording", agent_user, value: "STATUS" }),
  externalDial: (agent_user, phone) =>
    callVicidialAPI({
      function: "external_dial",
      agent_user,
      value: phone,
      phone_code: 1,
      search: "NO",
      preview: "NO",
      focus: "YES"
    }),
  hangupCall: (agent_user) =>
    callVicidialAPI({ function: "external_hangup", agent_user, value: 1 }),
  pauseAgent: (agent_user) =>
    callVicidialAPI({ function: "external_pause", agent_user, value: "PAUSE" }),
  setStatus: (agent_user, status) =>
    callVicidialAPI({ function: "external_status", agent_user, value: status }),
  transferCall: (agent_user, phone_number) =>
    callVicidialAPI({
      function: "transfer_conference",
      agent_user,
      value: "DIAL_WITH_CUSTOMER",
      phone_number
    })
};
