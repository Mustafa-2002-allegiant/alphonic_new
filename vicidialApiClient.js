// ─────────────────────────────────────────────────────────────
//  vicidialApiClient.js (Final Fixed Version)
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
console.log("✅ Loaded ENV:", process.env.VICIDIAL_BASE_URL);

const fetch = require("node-fetch");
const qs = require("querystring");
const https = require("https");

const agent = new https.Agent({ rejectUnauthorized: false });

const BASE_URL = "https://allegientlead.dialerhosting.com/agc/api.php";
const API_USER = "9999";
const API_PASS = "i6yhtrhgfh";
const SOURCE = "botapi";
const CAMPAIGN = "001"; // You can also use process.env.VICIDIAL_CAMPAIGN

const sessionMap = new Map(); // 🔒 In-memory session store

// 🔧 Core call handler
async function callVicidialAPI(params) {
  const body = qs.stringify({
    user: API_USER,
    pass: API_PASS,
    source: SOURCE,
    ...params,
  });

  console.log("[DEBUG] callVicidialAPI params:", params);
  console.log("[DEBUG] callVicidialAPI POST body:", body);

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      agent,
    });

    const text = await res.text();
    console.log(`[DEBUG] VICIdial ${params.function} raw response:`, text);
    return text;
  } catch (err) {
    console.error(`[ERROR] callVicidialAPI fetch failed:`, err);
    throw err;
  }
}

// 🔐 Agent login (via log_agent)
async function loginAgent(
  agent_user,
  agent_pass = process.env.VICIDIAL_AGENT_PASS,
  phone_login = process.env.VICIDIAL_PHONE_LOGIN,
  phone_pass = process.env.VICIDIAL_PHONE_PASS,
  campaign_id = process.env.VICIDIAL_CAMPAIGN || CAMPAIGN
) {
  const form = new URLSearchParams();
  form.append("user", API_USER);
  form.append("pass", API_PASS);
  form.append("source", "botapi");
  form.append("function", "log_agent");
  form.append("agent_user", agent_user);
  form.append("agent_pass", agent_pass);
  form.append("phone_login", phone_login);
  form.append("phone_pass", phone_pass);
  form.append("campaign", campaign_id);

  console.log("[DEBUG] loginAgent POST body:", form.toString());
  console.log("[DEBUG] loginAgent params:", {
    agent_user,
    agent_pass,
    phone_login,
    phone_pass,
    campaign_id,
  });

  try {
    const response = await fetch(`${process.env.VICIDIAL_BASE_URL}/agc/api.php`, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const responseText = await response.text();
    console.log("[DEBUG] loginAgent raw response:", responseText);

    const sessionMatch = responseText.match(/SESSION_ID=(\d+)/i);
    if (!sessionMatch) {
      console.error("[ERROR] Could not extract session_id. Full response:", responseText);
      throw new Error("Failed to extract session_id from login response");
    }

    const session_id = sessionMatch[1];
    sessionMap.set(agent_user, session_id);
    return session_id;
  } catch (err) {
    console.error("[ERROR] loginAgent fetch failed:", err);
    throw err;
  }
}

module.exports = {
  loginAgent,

  callAgent: async (agent_user) => {
    const session_id =
      sessionMap.get(agent_user) ||
      (await loginAgent(agent_user)); // 🧠 Uses .env for remaining args

    return callVicidialAPI({
      function: "external_dial",
      agent_user,
      session_user: agent_user,
      session_id,
      phone_code: "1",
      number_to_dial: "8600051",
      campaign: CAMPAIGN,
      search: "NO",
      preview: "NO",
      focus: "YES",
      format: "text",
    });
  },

  getRecordingStatus: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "recording",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "STATUS",
    });
  },

  hangupCall: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "external_hangup",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "1",
    });
  },

  pauseAgent: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "external_pause",
      agent_user,
      session_user: agent_user,
      session_id,
      value: "PAUSE",
    });
  },

  setStatus: async (agent_user, status) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function: "external_status",
      agent_user,
      session_user: agent_user,
      session_id,
      value: status,
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
      phone_number,
    });
  },
};
