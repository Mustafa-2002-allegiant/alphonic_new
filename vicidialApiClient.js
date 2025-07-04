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

  const url = BASE_URL;
  console.log("[DEBUG] callVicidialAPI URL:", url);
  console.log("[DEBUG] callVicidialAPI params:", params);
  console.log("[DEBUG] callVicidialAPI POST body:", body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      agent,
    });

    console.log("[DEBUG] callVicidialAPI HTTP status:", res.status);
    console.log("[DEBUG] callVicidialAPI HTTP headers:", JSON.stringify([...res.headers]));
    const text = await res.text();
    console.log(`[DEBUG] VICIdial ${params.function} raw response:`, JSON.stringify(text));
    if (!text) {
      console.error("[ERROR] callVicidialAPI: Empty response. Possible causes: wrong credentials, campaign, or server-side PHP error.");
    }
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

  const url = `${process.env.VICIDIAL_BASE_URL}/agc/api.php`;
  console.log("[DEBUG] loginAgent URL:", url);
  console.log("[DEBUG] loginAgent POST body:", form.toString());
  console.log("[DEBUG] loginAgent params:", {
    agent_user, agent_pass, phone_login, phone_pass, campaign_id
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      body: form,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    console.log("[DEBUG] loginAgent HTTP status:", response.status);
    console.log("[DEBUG] loginAgent HTTP headers:", JSON.stringify([...response.headers]));
    const responseText = await response.text();
    console.log("[DEBUG] loginAgent raw response:", JSON.stringify(responseText));

    const sessionMatch = responseText.match(/SESSION_ID=(\d+)/i);
    if (!sessionMatch) {
      console.error("[ERROR] Could not extract session_id. Full response:", responseText);
      if (!responseText) {
        console.error("[ERROR] loginAgent: Empty response. Possible causes: wrong credentials, campaign, or server-side PHP error.");
      }
      throw new Error("Failed to extract session_id from login response");
    }

    const session_id = sessionMatch[1];
    sessionMap.set(agent_user, session_id);
    console.log(`[DEBUG] loginAgent: Successfully extracted session_id: ${session_id}`);
    return session_id;
  } catch (err) {
    console.error("[ERROR] loginAgent fetch failed:", err);
    throw err;
  }
}

module.exports = {
    loginAgent,
  
    callAgent: async (agent_user) => {
      const agent_pass = 'hello123';
      const phone_login = agent_user;
      const phone_pass = 'hello123';
      const campaign_id = '002';
  
      const session_id =
        sessionMap.get(agent_user) ||
        await loginAgent(agent_user, agent_pass, phone_login, phone_pass, campaign_id);
  
      return callVicidialAPI({
        function: "external_dial",
        agent_user,
        session_user: agent_user,
        session_id,
        phone_code: "1",
        number_to_dial: "8600051",
        campaign: campaign_id,
        search: "NO",
        preview: "NO",
        focus: "YES",
        format: "text"
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
  
