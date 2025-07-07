// ─────────────────────────────────────────────────────────────
// vicidialApiClient.js
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const fetch     = require("node-fetch");
const qs        = require("querystring");
const https     = require("https");
const puppeteer = require("puppeteer");       // NEW

const AGENT = new https.Agent({ rejectUnauthorized: false });

// Core Vicidial API URL (for callAgent, etc)
const BASE_URL  = process.env.VICIDIAL_API_URL;     // e.g. https://host/agc/api.php
const API_USER  = process.env.VICIDIAL_API_USER;    // your API user
const API_PASS  = process.env.VICIDIAL_API_PASS;    // your API pass
const SOURCE    = process.env.VICIDIAL_SOURCE;      // e.g. botapi
const CAMPAIGN  = process.env.VICIDIAL_CAMPAIGN;    // e.g. 001

// The PHP login endpoint your host provides
const PHP_LOGIN  = process.env.VALIDATE_FIREWALL_URL; 
// e.g. https://allegientlead.dialerhosting.com:81/validatefirewall.php

// In-memory cache: agent_user → session_id
const sessionMap = new Map();

/**
 * Helper to call the Vicidial AGC API via HTTP POST.
 */
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

/**
 * Logs an agent in by driving the PHP firewall‐login page
 * with Puppeteer and extracting the SESSION_ID.
 */
async function loginAgent(agent_user) {
  // Return cached session_id if we have one
  if (sessionMap.has(agent_user)) {
    return sessionMap.get(agent_user);
  }

  console.log("▶️ Launching browser to log in agent", agent_user);
  const browser = await puppeteer.launch({
    args: ["--no-sandbox","--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // 1) Navigate to the PHP login form
  await page.goto(PHP_LOGIN, { waitUntil: "networkidle2" });

  // 2) Fill in the credentials
  await page.type("input[name='user']",        API_USER);
  await page.type("input[name='pass']",        API_PASS);
  await page.type("input[name='agent_user']",  agent_user);
  await page.type("input[name='agent_pass']",  process.env.VICIDIAL_AGENT_PASS);
  await page.type("input[name='phone_login']", process.env.VICIDIAL_PHONE_LOGIN);
  await page.type("input[name='phone_pass']",  process.env.VICIDIAL_PHONE_PASS);
  await page.type("input[name='campaign']",    CAMPAIGN);

  // 3) Submit and wait for navigation
  await Promise.all([
    page.click("button[type='submit']"),
    page.waitForNavigation({ waitUntil: "networkidle2" })
  ]);

  // 4) Extract SESSION_ID from URL or page HTML
  let session_id = null;
  const finalUrl = page.url();
  const mUrl = finalUrl.match(/SESSION_ID=(\d+)/i);
  if (mUrl) {
    session_id = mUrl[1];
  } else {
    const html = await page.content();
    const mHtml = html.match(/SESSION_ID=(\d+)/i);
    if (mHtml) session_id = mHtml[1];
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

  /**
   * Dial the agent via the AGC API (external_dial).
   */
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

  /**
   * Check recording status.
   */
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

  /**
   * Hang up the call.
   */
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

  /**
   * Update agent status (e.g. “AVAILABLE”).
   */
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

  /**
   * Transfer the call to the agent conference.
   */
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
