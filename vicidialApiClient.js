// ─────────────────────────────────────────────────────────────
// vicidialApiClient.js
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const fetch = require("node-fetch");
const qs    = require("querystring");
const https = require("https");

const AGENT = new https.Agent({ rejectUnauthorized: false });

const BASE_URL  = `${process.env.VICIDIAL_BASE_URL}/agc/api.php`;
const API_USER  = process.env.VICIDIAL_API_USER;
const API_PASS  = process.env.VICIDIAL_API_PASS;
const SOURCE    = process.env.VICIDIAL_SOURCE;
const CAMPAIGN  = process.env.VICIDIAL_CAMPAIGN;

const sessionMap = new Map(); // agent_user → session_id

async function callVicidialAPI(params) {
  const body = qs.stringify({
    user:   API_USER,
    pass:   API_PASS,
    source: SOURCE,
    hasSSL: "true",
    ...params
  });

  const res = await fetch(BASE_URL, {
    method:  "POST",
    agent:   AGENT,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await res.text();
  console.log(`📡 VICIdial ${params.function} →`, text);
  return text;
}

async function loginAgent(agent_user) {
  // Call via callVicidialAPI so user/pass/source/hasSSL are auto-injected
  const text = await callVicidialAPI({
    function:     "log_agent",
    agent_user,                                 // your agent’s user ID
    agent_pass:   process.env.VICIDIAL_AGENT_PASS,
    phone_login:  process.env.VICIDIAL_PHONE_LOGIN,
    phone_pass:   process.env.VICIDIAL_PHONE_PASS,
    campaign:     CAMPAIGN,
    format:       "text"                        // ensure text-mode response
  });

  console.log("🔐 log_agent →", text);

  // Vicidial typically returns something like "... SESSION_ID=12345 ..."
  const m = text.match(/SESSION_ID=(\d+)/i);
  if (!m) {
    throw new Error(`Failed to extract session_id from login response: ${text}`);
  }

  const session_id = m[1];
  sessionMap.set(agent_user, session_id);
  return session_id;
}


module.exports = {
  callVicidialAPI,
  loginAgent,
  callAgent: async (agent_user) => {
    const session_id = sessionMap.get(agent_user) || await loginAgent(agent_user);
    return callVicidialAPI({
      function:       "external_dial",
      agent_user,
      session_user:   agent_user,
      session_id,
      phone_code:     "1",
      number_to_dial: "8600051",
      campaign:       CAMPAIGN,
      search:         "NO",
      preview:        "NO",
      focus:          "YES",
      format:         "text"
    });
  },

  getRecordingStatus: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "recording",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        "STATUS"
    });
  },

  hangupCall: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_hangup",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        "1"
    });
  },

  setStatus: async (agent_user, status) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_status",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        status
    });
  },

  transferCall: async (agent_user, phone_number = "8600051") => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:      "transfer_conference",
      agent_user,
      session_user:  agent_user,
      session_id,
      value:         "DIAL_WITH_CUSTOMER",
      phone_number
    });
  },
};
