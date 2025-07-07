// ─────────────────────────────────────────────────────────────
// vicidialApiClient.js (using Playwright)
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const fetch    = require("node-fetch");
const qs       = require("querystring");
const https    = require("https");
const { chromium } = require("playwright");  // <<< PLAYWRIGHT BROWSER

const AGENT = new https.Agent({ rejectUnauthorized: false });

// Vicidial AGC API settings
const BASE_URL  = process.env.VICIDIAL_API_URL;
const API_USER  = process.env.VICIDIAL_API_USER;
const API_PASS  = process.env.VICIDIAL_API_PASS;
const SOURCE    = process.env.VICIDIAL_SOURCE;
const CAMPAIGN  = process.env.VICIDIAL_CAMPAIGN;

// Your host’s PHP‐login URL
const PHP_LOGIN = process.env.VALIDATE_FIREWALL_URL;

// Cache of agent_user → session_id
const sessionMap = new Map();

async function callVicidialAPI(params) {
  const body = qs.stringify({
    user: API_USER,
    pass: API_PASS,
    source: SOURCE,
    hasSSL: "true",
    ...params,
  });

  const res = await fetch(BASE_URL, {
    method: "POST",
    agent: AGENT,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  console.log(`📡 VICIdial ${params.function} →`, text.trim());
  return text;
}

async function loginAgent(agent_user) {
  if (sessionMap.has(agent_user)) {
    return sessionMap.get(agent_user);
  }

  console.log("▶️ Launching headless Playwright to log in agent", agent_user);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // 1) go to PHP form
  await page.goto(PHP_LOGIN);

  // 2) fill credentials
  await page.fill("input[name='user']",        API_USER);
  await page.fill("input[name='pass']",        API_PASS);
  await page.fill("input[name='agent_user']",  agent_user);
  await page.fill("input[name='agent_pass']",  process.env.VICIDIAL_AGENT_PASS);
  await page.fill("input[name='phone_login']", process.env.VICIDIAL_PHONE_LOGIN);
  await page.fill("input[name='phone_pass']",  process.env.VICIDIAL_PHONE_PASS);
  await page.fill("input[name='campaign']",    CAMPAIGN);

  // 3) submit & wait
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForNavigation()
  ]);

  // 4) scrape SESSION_ID
  let session_id = null;
  const urlMatch = page.url().match(/SESSION_ID=(\d+)/i);
  if (urlMatch) {
    session_id = urlMatch[1];
  } else {
    const html = await page.content();
    const htmlMatch = html.match(/SESSION_ID=(\d+)/i);
    if (htmlMatch) session_id = htmlMatch[1];
  }

  await browser.close();
  if (!session_id) {
    throw new Error(`Failed to retrieve SESSION_ID for agent ${agent_user}`);
  }

  console.log("🔐 Obtained SESSION_ID:", session_id);
  sessionMap.set(agent_user, session_id);
  return session_id;
}

module.exports = {
  callVicidialAPI,
  loginAgent,

  async callAgent(agent_user) {
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
      format:         "text",
    });
  },

  async getRecordingStatus(agent_user) {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "recording",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        "STATUS",
    });
  },

  async hangupCall(agent_user) {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_hangup",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        "1",
    });
  },

  async setStatus(agent_user, status) {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_status",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        status,
    });
  },

  async transferCall(agent_user, phone_number = "8600051") {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:      "transfer_conference",
      agent_user,
      session_user:  agent_user,
      session_id,
      value:         "DIAL_WITH_CUSTOMER",
      phone_number,
    });
  },
};
