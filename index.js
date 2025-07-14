// ───────────────────────────────────────────────────────────────────────────────
// index.js
// ───────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const fetch     = require("node-fetch");
const qs        = require("querystring");


const db                   = require("./firebaseConfig");
const { speakText }        = require("./TTSService");
const { recognizeLiveAudio } = require("./liveSTTHandler");
const classifyResponse     = require("./classifyResponse");

const {
  setWebSessionId,       // NEW: To set the session ID from web
  getSessionId,          // NEW: To get existing session ID
  callVicidialAPI,       // for /debug/webserver
  loginAgent,            // if you choose to explicitly log in
  callAgent,
  getRecordingStatus,
  hangupCall,
  setStatus,
  transferCall
} = require("./vicidialApiClient");

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/audio", express.static(path.join(__dirname, "audio")));

app.get("/hello", (req, res) => {
  res.status(200).send("👋 Hello world");
});
// debug endpoint: test only the loginAgent function
app.get("/debug/login-agent", async (req, res) => {
  const agent_user = req.query.agent_user || process.env.VICIDIAL_PHONE_LOGIN;
  try {
    const session_id = await loginAgent(agent_user);
    return res.json({ agent_user, session_id });
  } catch (err) {
    console.error("❌ debug/login-agent error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// NEW: Endpoint to login agent via web interface and store session ID
app.post("/web-login-agent", async (req, res) => {
  const { agent_user } = req.body;
  if (!agent_user) {
    return res.status(400).json({ error: "agent_user required" });
  }
  
  try {
    console.log(`🌐 Starting web login for agent: ${agent_user}`);
    
    // Use VicidialWebAutomation to login via web interface
    const VicidialWebAutomation = require('./vicidialWebAutomation');
    const automation = new VicidialWebAutomation();
    
    await automation.initialize();
    
    // Login agent and get the real ViciDial session ID
    const webSessionId = await automation.loginAgent(agent_user, process.env.VICIDIAL_AGENT_PASS);
    
    // Store this session ID in our API client for future API calls
    setWebSessionId(agent_user, webSessionId);
    
    await automation.close();
    
    console.log(`✅ Web login successful. Session ID stored: ${webSessionId}`);
    
    return res.json({
      success: true,
      agent_user,
      sessionId: webSessionId,
      message: "Agent logged in via web interface, session ID stored for API calls"
    });
    
  } catch (err) {
    console.error("❌ web-login-agent error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// debug endpoint

app.get("/debug/webserver", async (req, res) => {
  try {
    const info = await require("./vicidialApiClient").callVicidialAPI({
      function: "webserver"
    });
    res.type("text/plain").send(info);
  } catch (err) {
    console.error("❌ debug/webserver error:", err);
    res.status(500).send(err.toString());
  }
});


// ─────────────────────────────────────────────────────────────
// index.js (only the /start-bot-session route shown)
// ─────────────────────────────────────────────────────────────
app.post("/start-bot-session", async (req, res) => {


  const { agent_user, botId } = req.body;
  if (!agent_user || !botId) {
    return res.status(400).json({ error: "agent_user and botId required" });
  }

  try {
    // 1) Get the existing web session ID (agent must be logged in via /web-login-agent first)
    console.log("🔍 Getting existing web session for", agent_user);
    const vicidialSessionId = getSessionId(agent_user);
    console.log("✅ Using existing ViciDial session ID:", vicidialSessionId);

    // 2) Transfer the call into a conference with the agent
    console.log("📞 transferCall for", agent_user);
    await transferCall(agent_user);

    // 3) Dial the agent from that conference
    console.log("📡 callAgent for", agent_user);
    await callAgent(agent_user);

    // 4) Optionally start recording
    console.log("🎙 getRecordingStatus for", agent_user);
    await getRecordingStatus(agent_user);

    // 5) Fetch your bot script from Firestore
    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists) {
      console.log("❌ Bot not found:", botId);
      return res.status(404).json({ error: "Bot not found" });
    }

    const script    = botDoc.data().script || [];
    const voice     = botDoc.data().voice  || "en-US-Wavenet-F";
    const audioPath = await speakText(script[0], voice);

    // 6) Create a session document with BOTH IDs
    const sessionRef = await db.collection("bot_sessions").add({
      botId,
      agent_user,
      vicidialSessionId,     // ← Store the REAL ViciDial session ID
      firestoreSessionId: null,  // Will be set after creation
      currentStep: 0,
      responses:   [],
      done:        false,
      createdAt:   new Date().toISOString(),
    });

    // Update with Firestore session ID for tracking
    await sessionRef.update({ firestoreSessionId: sessionRef.id });

    // 7) Return the ViciDial session ID (NOT the Firestore ID)
    return res.json({
      sessionId: vicidialSessionId,     // ← Return the REAL ViciDial session ID
      firestoreId: sessionRef.id,      // ← Also return Firestore ID for tracking
      question:  script[0],
      audioPath: path.basename(audioPath),
      step:      0,
    });

  } catch (err) {
    console.error("❌ start-bot-session error:", err);
    return res.status(500).json({ error: err.message });
  }
});


app.post("/bot-session/:sessionId/respond", async (req, res) => {
  const { sessionId } = req.params;  // This is now the ViciDial session ID
  const audioBuffer   = req.body.audio;
  if (!audioBuffer) return res.status(400).json({ error: "audio required" });

  try {
    // Find session by ViciDial session ID instead of Firestore ID
    const sessionQuery = await db.collection("bot_sessions")
      .where("vicidialSessionId", "==", sessionId)
      .limit(1)
      .get();
    
    if (sessionQuery.empty) {
      return res.status(404).json({ error: "Session not found" });
    }
    
    const sessionDoc = sessionQuery.docs[0];
    const sessionRef = sessionDoc.ref;

    const session = sessionDoc.data();
    if (session.done) {
      return res.json({ done: true, message: "Session complete" });
    }

    const botDoc = await db.collection("bots").doc(session.botId).get();
    const script = botDoc.data().script;
    const voice  = botDoc.data().voice;

    recognizeLiveAudio(audioBuffer, script[session.currentStep], async (err, resultText) => {
      const classification = classifyResponse(resultText);
      const responses      = [ ...session.responses, { step: session.currentStep, text: resultText, classification } ];

      let done    = false;
      let message = "";
      let audio   = null;

      if (classification === "yes") {
        await transferCall(session.agent_user);
        done    = true;
        message = "Transferring to live agent.";
      }
      else if (classification === "no") {
        await setStatus(session.agent_user, "A");
        await hangupCall(session.agent_user);
        done    = true;
        message = "Ending call.";
      }
      else {
        const nextStep = session.currentStep + 1;
        if (nextStep >= script.length) {
          done    = true;
          message = "Script complete.";
        } else {
          message = script[nextStep];
          audio   = await speakText(message, voice);
        }
        await sessionRef.update({ currentStep: nextStep, responses, done });
      }

      res.json({
        classification,
        message,
        done,
        audioPath: audio ? path.basename(audio) : null
      });
    });
  } catch (err) {
    console.error("❌ bot-session error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Rewritten VICIdial API routes using PHP endpoints
app.get("/vcdial-agents", async (req, res) => {
  try {
    const response = await fetch("https://allegientlead.dialerhosting.com/get_vicidial_agents.php");
    if (!response.ok) throw new Error("VICIdial agent PHP fetch failed");
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/campaigns", async (req, res) => {
  try {
    const response = await fetch("https://allegientlead.dialerhosting.com/get_campaigns.php");
    if (!response.ok) throw new Error("Campaign PHP fetch failed");
    const data = await response.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.get("/active-bots", async (req, res) => {
  try {
    const snapshot = await db.collection("bots").get();
    const bots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(bots);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


app.post("/bot", async (req, res) => {
  const { botId, script, voice } = req.body;
  if (!botId || !script) return res.status(400).json({ error: "Missing botId or script" });

  try {
    await db.collection("bots").doc(botId).set({
      bot_name: botId,
      script,
      voice,
      createdAt: new Date().toISOString()
    });
    return res.json({ message: `Bot ${botId} created.` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/assign-bot-to-agent-and-campaign", async (req, res) => {
  const { botId, campaignId, agentId } = req.body;
  if (!botId || !campaignId || !agentId)
    return res.status(400).json({ error: "botId, campaignId and agentId are required" });

  try {
    await db.collection("bot_assignments").add({
      botId,
      campaignId,
      agentId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    const phpAgentRes = await fetch("https://allegientlead.dialerhosting.com/assign_agent_to_campaign.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, campaignId })
    });

    if (!phpAgentRes.ok) throw new Error("Failed assigning agent in VICIdial");

    const phpBotRes = await fetch("https://allegientlead.dialerhosting.com/update_bot_assignments.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ botId, campaignId, agentId })
    });

    const bodyText = await phpBotRes.text();
    if (!phpBotRes.ok) throw new Error(`PHP bot error: ${bodyText}`);

    const botResult = JSON.parse(bodyText);
    return res.json({ success: true, botResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// NEW: Enhanced bot assignment with automatic agent login
app.post("/assign-bot-with-auto-login", async (req, res) => {
  const { botId, campaignId, agentUser } = req.body;
  if (!botId || !campaignId || !agentUser) {
    return res.status(400).json({ error: "botId, campaignId and agentUser are required" });
  }

  // Validate agent user is in valid range (8001-8030)
  const agentNumber = parseInt(agentUser);
  if (agentNumber < 8001 || agentNumber > 8030) {
    return res.status(400).json({ error: "Agent user must be between 8001 and 8030" });
  }

  try {
    console.log(`🚀 Starting enhanced bot assignment for agent: ${agentUser}`);
    
    // Use the enhanced assignment function
    const { assignBotToAgent } = require('./assignBotToCampaign');
    const assignment = await assignBotToAgent(botId, campaignId, agentUser);
    
    console.log(`✅ Enhanced assignment completed:`, assignment);
    
    return res.json({
      success: true,
      message: "Bot assigned to agent with automatic login",
      data: assignment
    });
    
  } catch (err) {
    console.error(`❌ Enhanced assignment failed:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// NEW: Refresh agent session endpoint
app.post("/refresh-agent-session", async (req, res) => {
  const { agentUser } = req.body;
  if (!agentUser) {
    return res.status(400).json({ error: "agentUser is required" });
  }

  try {
    console.log(`🔄 Refreshing session for agent: ${agentUser}`);
    
    const { refreshAgentSession } = require('./assignBotToCampaign');
    const newSessionId = await refreshAgentSession(agentUser);
    
    return res.json({
      success: true,
      message: "Agent session refreshed successfully",
      agentUser,
      sessionId: newSessionId
    });
    
  } catch (err) {
    console.error(`❌ Session refresh failed:`, err);
    return res.status(500).json({ error: err.message });
  }
});

// NEW: Get available agents endpoint
app.get("/available-agents", (req, res) => {
  try {
    const { getAvailableAgents } = require('./assignBotToCampaign');
    const agents = getAvailableAgents();
    
    return res.json({
      success: true,
      agents,
      count: agents.length
    });
    
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Cleaned VICIdial bot backend running on port ${PORT}`);
});
