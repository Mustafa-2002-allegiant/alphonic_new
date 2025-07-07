// ─────────────────────────────────────────────────────────────
// vicidialApiClient.js
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const fetch = require("node-fetch");
const qs    = require("querystring");
const https = require("https");

const AGENT = new https.Agent({ rejectUnauthorized: false });

// core AGC API
const BASE_URL = process.env.VICIDIAL_API_URL;
const API_USER = process.env.VICIDIAL_API_USER;
const API_PASS = process.env.VICIDIAL_API_PASS;
const SOURCE   = process.env.VICIDIAL_SOURCE;
const CAMPAIGN = process.env.VICIDIAL_CAMPAIGN;

// your PHP firewall login URL
const PHP_LOGIN = process.env.VALIDATE_FIREWALL_URL;

// cache agent → session
const sessionMap = new Map();

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
  console.log(`📡 VICIdial ${params.function} →`, text.trim());
  return text;
}

async function loginAgent(agent_user) {
  // return cached if we already have it
  if (sessionMap.has(agent_user)) {
    return sessionMap.get(agent_user);
  }

  // build form body for PHP login
  const body = qs.stringify({
    user:        API_USER,
    pass:        API_PASS,
    agent_user,
    agent_pass:  process.env.VICIDIAL_AGENT_PASS,
    phone_login: process.env.VICIDIAL_PHONE_LOGIN,
    phone_pass:  process.env.VICIDIAL_PHONE_PASS,
    campaign:    CAMPAIGN,
  });

  // POST without following redirects
  const res = await fetch(PHP_LOGIN, {
    method:   "POST",
    agent:    AGENT,
    redirect: "manual",
    headers:  { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  // 1) Try to grab SESSION_ID from `Location:` header
  let session_id = null;
  const loc = res.headers.get("location");
  if (loc) {
    const m = loc.match(/SESSION_ID=(\d+)/i);
    if (m) session_id = m[1];
  }

  // 2) If no header, fetch the HTML and scrape it
  if (!session_id) {
    const text = await res.text();
    const m = text.match(/SESSION_ID=(\d+)/i);
    if (m) session_id = m[1];
  }

  if (!session_id) {
    throw new Error("loginAgent: could not extract SESSION_ID");
  }

  console.log("🔐 loginAgent →", session_id);
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
