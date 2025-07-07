// ─────────────────────────────────────────────────────────────
// vicidialApiClient.js
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const fetch     = require("node-fetch");
const qs        = require("querystring");
const https     = require("https");
const { chromium } = require("playwright");  // USE PLAYWRIGHT

const AGENT     = new https.Agent({ rejectUnauthorized: false });

// core AGC API
const BASE_URL  = process.env.VICIDIAL_API_URL;
const API_USER  = process.env.VICIDIAL_API_USER;
const API_PASS  = process.env.VICIDIAL_API_PASS;
const SOURCE    = process.env.VICIDIAL_SOURCE;
const CAMPAIGN  = process.env.VICIDIAL_CAMPAIGN;

// your PHP firewall login URL
const PHP_LOGIN = process.env.VALIDATE_FIREWALL_URL;
if (!PHP_LOGIN || !/^https?:\/\//.test(PHP_LOGIN)) {
  throw new Error("Missing or invalid VALIDATE_FIREWALL_URL");
}

// in-memory cache: agent_user → session_id
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

/**
 * Logs the agent in by POST-ing to your PHP firewall page
 * and pulling SESSION_ID out of the 302 Location header
 * or from the HTML response body.
 */
async function loginAgent(agent_user) {
  if (sessionMap.has(agent_user)) {
    console.log("🔑 [cached] SESSION_ID for", agent_user, "→", sessionMap.get(agent_user));
    return sessionMap.get(agent_user);
  }

  console.log("▶️  Starting headless login for agent", agent_user);
  const browser = await chromium.launch({ headless: true });
  const page    = await browser.newPage({ 
    ignoreHTTPSErrors: true, 
  });

  // instead of filling forms, we can directly POST via page.request
  const postBody = qs.stringify({
    user:        API_USER,
    pass:        API_PASS,
    agent_user,
    agent_pass:  process.env.VICIDIAL_AGENT_PASS,
    phone_login: process.env.VICIDIAL_PHONE_LOGIN,
    phone_pass:  process.env.VICIDIAL_PHONE_PASS,
    campaign:    CAMPAIGN,
  });

  // do the POST without auto-redirect (302)
  const resp = await page.request.fetch(PHP_LOGIN, {
    method:   "POST",
    headers:  { "Content-Type": "application/x-www-form-urlencoded" },
    body:     postBody,
    redirect: "manual"
  });
  console.log("🔁  HTTP", resp.status(), resp.statusText());

  // 1) check Location header
  let session_id = null;
  const location = resp.headers()["location"];
  console.log("📥  Location header:", location);
  if (location) {
    const m = location.match(/SESSION_ID=(\d+)/i);
    if (m) session_id = m[1];
  }

  // 2) fallback to scraping the body
  if (!session_id) {
    const html = await resp.text();
    console.log("📄  Response HTML snippet:", html.slice(0,500).replace(/\n/g," "));
    const m = html.match(/SESSION_ID=(\d+)/i);
    if (m) session_id = m[1];
  }

  await browser.close();
  if (!session_id) {
    throw new Error("loginAgent: could not extract SESSION_ID");
  }

  console.log("🔐  loginAgent →", session_id);
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
