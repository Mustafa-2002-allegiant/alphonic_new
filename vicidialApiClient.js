require("dotenv").config();
const fetch = require("node-fetch");
const qs    = require("querystring");
const https = require("https");

const AGENT = new https.Agent({ rejectUnauthorized: false });

const BASE_URL    = `${process.env.VICIDIAL_BASE_URL}/agc/agent_api.php`;
const API_USER    = process.env.VICIDIAL_API_USER;
const API_PASS    = process.env.VICIDIAL_API_PASS;
const SOURCE      = process.env.VICIDIAL_SOURCE || "botapi";
const CAMPAIGN    = process.env.VICIDIAL_CAMPAIGN;

const sessionMap = new Map();  // agent_user → session_id

/**
 * Send any VICIdial Agent API call.
 */
async function callVicidialAPI(params) {
  const body = qs.stringify({
    user:   API_USER,
    pass:   API_PASS,
    source: SOURCE,
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
 * log_agent — establishes a valid session and caches session_id per agent_user
 */
async function loginAgent(agent_user) {
  // pull credentials from env
  const form = new URLSearchParams();
  form.append("user",        API_USER);
  form.append("pass",        API_PASS);
  form.append("source",      SOURCE);
  form.append("function",    "log_agent");
  form.append("agent_user",  agent_user);
  form.append("agent_pass",  process.env.VICIDIAL_AGENT_PASS);
  form.append("phone_login", process.env.VICIDIAL_PHONE_LOGIN);
  form.append("phone_pass",  process.env.VICIDIAL_PHONE_PASS);
  form.append("campaign",    CAMPAIGN);

  const resp = await fetch(BASE_URL, {
    method:  "POST",
    agent:   AGENT,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    form.toString()
  });
  const txt = await resp.text();
  console.log("🔐 log_agent →", txt);

  // expected format: SUCCESS... SESSION_ID=123456 ...
  const m = txt.match(/SESSION_ID=([0-9]+)/i);
  if (!m) throw new Error(`Failed to extract session_id from login response: ${txt}`);
  const session_id = m[1];
  sessionMap.set(agent_user, session_id);
  return session_id;
}

module.exports = {
  /**
   * Places a manual dial on the agent’s screen.
   */
  callAgent: async (agent_user) => {
    const session_id = sessionMap.get(agent_user) || await loginAgent(agent_user);
    return callVicidialAPI({
      function:     "external_dial",
      agent_user,
      session_user: agent_user,
      session_id,
      phone_code:   "1",
      number_to_dial: "8600051",
      campaign:       CAMPAIGN,
      search:         "NO",
      preview:        "NO",
      focus:          "YES",
      format:         "text"
    });
  },

  /**
   * report recording status
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
   * Hangup the current call
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
   * Pause the agent once current call is finished
   */
  pauseAgent: async (agent_user) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_pause",
      agent_user,
      session_user: agent_user,
      session_id,
      value:        "PAUSE"
    });
  },

  /**
   * Set disposition status
   */
  setStatus: async (agent_user, status) => {
    const session_id = sessionMap.get(agent_user);
    return callVicidialAPI({
      function:     "external_status",
      agent_user,
      session_user: agent_user,
      session_id,
      value: status
    });
  },

  /**
   * 3-way conference transfer
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
  }
};
