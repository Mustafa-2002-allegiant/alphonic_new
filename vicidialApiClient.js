// vicidialApiClient.js
require("dotenv").config();
const fetch = require("node-fetch");
const qs    = require("querystring");
const https = require("https");

const AGENT     = new https.Agent({ rejectUnauthorized: false });
const BASE_URL  = process.env.VICIDIAL_API_URL;    // e.g. https://host/agc/api.php
const API_USER  = process.env.VICIDIAL_API_USER;   // your API user
const API_PASS  = process.env.VICIDIAL_API_PASS;   // your API pass
const SOURCE    = process.env.VICIDIAL_SOURCE;     // e.g. botapi
const CAMPAIGN  = process.env.VICIDIAL_CAMPAIGN;   // e.g. 001

const sessionMap = new Map();

async function callVicidialAPI(params) {
  const allParams = {
    user:            API_USER,
    pass:            API_PASS,
    source:          SOURCE,
    has_ssl:         "1",            // <-- note the exact underscore name
    protocol_version:"2",            // <-- recommended by Vicidial docs
    ...params
  };

  console.log("🔃 AGC REQUEST →", allParams);
  const body = qs.stringify(allParams);

  const res  = await fetch(BASE_URL, {
    method:  "POST",
    agent:   AGENT,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  const text = await res.text();
  console.log(`📡 AGC RESPONSE [${params.function}] →\n${text.trim()}\n`);
  return text;
}

async function loginAgent(agent_user) {
  if (sessionMap.has(agent_user)) {
    console.log("🔑 [cache] SESSION_ID for", agent_user, "→", sessionMap.get(agent_user));
    return sessionMap.get(agent_user);
  }

  console.log("▶️  loginAgent via AGC for", agent_user);
  const respText = await callVicidialAPI({
    function:     "log_agent",            // AGC’s built-in agent login
    agent_user,
    agent_pass:   process.env.VICIDIAL_AGENT_PASS,
    phone_login:  process.env.VICIDIAL_PHONE_LOGIN,
    phone_pass:   process.env.VICIDIAL_PHONE_PASS,
    campaign:     CAMPAIGN,
    format:       "text"
  });

  // Vicidial returns "... SESSION_ID=12345 ..." somewhere in the text
  const m = respText.match(/SESSION_ID=(\d+)/i);
  if (!m) {
    console.error("🚨 loginAgent FAILED, full response:\n", respText);
    throw new Error("loginAgent: could not extract SESSION_ID");
  }

  const session_id = m[1];
  console.log("🔐 loginAgent SUCCESS → SESSION_ID =", session_id);
  sessionMap.set(agent_user, session_id);
  return session_id;
}

module.exports = {
  callVicidialAPI,
  loginAgent,

  callAgent: async (agent_user) => {
    const session_id = await loginAgent(agent_user);
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
      function: "recording",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "STATUS"
    });
  },

  hangupCall: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "external_hangup",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "1"
    });
  },

  setStatus: async (agent_user, status) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "external_status",
      agent_user,
      session_user: agent_user,
      session_id,
      value: status
    });
  },

  transferCall: async (agent_user, phone_number = "8600051") => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "transfer_conference",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "DIAL_WITH_CUSTOMER",
      phone_number
    });
  },
};
