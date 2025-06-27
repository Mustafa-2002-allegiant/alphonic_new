// ───────────────────────────────────────────────────────────────────────────────
//  index.js  (Full Node/Express backend; ready to copy/paste)
//  Includes new logic to call update_bot.php whenever a bot is created/updated,
//  and uses HTTPS for all PHP calls.
// ───────────────────────────────────────────────────────────────────────────────

require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const path    = require("path");
const fetch   = require("node-fetch");

const db = require("./firebaseConfig"); // Firestore instance from firebaseConfig.js

// Load STT/TTS modules (mock or real)
const { streamToVosk } =
  process.env.USE_MOCK_STT === "true"
    ? require("./sttClient.mock")
    : require("./sttClient");
const { speakText } =
  process.env.USE_MOCK_TTS === "true"
    ? require("./TTSService.mock")
    : require("./TTSService");
const { recognizeLiveAudio } =
  process.env.USE_MOCK_STT === "true"
    ? require("./liveSTTHandler.mock")
    : require("./liveSTTHandler");
const classifyResponse = require("./classifyResponse");

const app = express();
const PORT = process.env.PORT || 8080;

// 1) Serve static audio files if you have any
app.use("/audio", express.static(path.join(__dirname)));

// 2) Enable CORS (so React on localhost:5173 can talk to these endpoints)
app.use(cors());

// 3) JSON parser for most routes (up to 10 MB)
app.use(express.json({ limit: "10mb" }));

// 4) RAW parser for /start-bot (audio/wav payloads, up to 10 MB)
app.use(
  "/start-bot",
  express.raw({ type: "audio/wav", limit: "10mb" })
);

// ───────────────────────────────────────────────────────────────────────────────
//  Password hashing helpers
// ───────────────────────────────────────────────────────────────────────────────
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// ───────────────────────────────────────────────────────────────────────────────
//  [ BOT ROUTES ]  (Firestore‐backed + VICIdial MySQL sync)
// ───────────────────────────────────────────────────────────────────────────────

// Create or update a bot in Firestore AND record it in VICIdial's MySQL via PHP
app.post("/bot", async (req, res) => {
  const { botId, script, voice } = req.body;
  if (!botId || !script || !Array.isArray(script)) {
    return res.status(400).json({ error: "botId and script (array) required" });
  }

  try {
    // 1) Write to Firestore
    await db.collection("bots").doc(botId).set({
      script,
      sessionProgress: { currentLine: 0 },
      isArchived: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      voice: voice || "en-US-Wavenet-F",
    });

    // 2) Also call the PHP endpoint on VICIdial to insert/update in MySQL
    try {
      const phpRes = await fetch("https://allegientlead.dialerhosting.com/update_bot.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId }),
      });

      const phpText = await phpRes.text().catch(() => "{}");
      if (!phpRes.ok) {
        console.error("PHP /update_bot.php returned error:", phpText);
        // Do NOT fail the entire request—Firestore write already succeeded
      } else {
        console.log("PHP /update_bot.php response:", phpText);
      }
    } catch (phpErr) {
      console.error("Failed to call update_bot.php:", phpErr.message);
      // swallow PHP errors to avoid breaking the main /bot response
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to save bot", details: err.message });
  }
});

// Fetch all active (non-archived) bots from VICIdial's PHP script
app.get("/active-bots", async (req, res) => {
  try {
    const snapshot = await db
      .collection("bots")
      .where("isActive", "==", true)
      .where("isArchived", "==", false)
      .get();
    const bots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return res.json(bots);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch active bots", details: err.message });
  }
});

// Test TTS: generate a voice file and return its filename
app.post("/test-voice", async (req, res) => {
  const { text, voice } = req.body;
  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }
  try {
    const outputPath = await speakText(text, voice || "en-US-Wavenet-F");
    if (!outputPath) {
      return res.status(500).json({ error: "TTS failed to generate audio file." });
    }
    return res.json({ success: true, path: path.basename(outputPath) });
  } catch (err) {
    return res.status(500).json({ error: err.message || "TTS failed" });
  }
});

// RAW-WAV STT route: accept audio buffer, run speech-to-text, store in Firestore
app.post("/start-bot", async (req, res) => {
  try {
    const audioBuffer = req.body; // entire WAV file buffer
    const lastBotMessage = req.query.lastLine || "Do you want to speak with a human?";
    recognizeLiveAudio(audioBuffer, lastBotMessage, async (err, result) => {
      if (err) {
        return res.status(500).json({ error: "STT failed" });
      }
      // Save STT result to Firestore
      await db.collection("bot_sessions").add({
        ...result,
        timestamp: new Date().toISOString(),
      });
      return res.json(result);
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to process audio", details: err.message });
  }
});

// Test entire bot script: generate TTS audio for each step and return filenames
app.post("/test-bot-script", async (req, res) => {
  const { script, voice } = req.body;
  if (!script || !Array.isArray(script) || script.length === 0) {
    return res.status(400).json({ error: "Script (array) is required" });
  }
  try {
    const audioPaths = [];
    for (const step of script) {
      const outputPath = await speakText(step, voice || "en-US-Wavenet-F");
      if (!outputPath) {
        return res.status(500).json({ error: "TTS failed to generate audio file." });
      }
      audioPaths.push(path.basename(outputPath));
    }
    return res.json({ success: true, audios: audioPaths });
  } catch (err) {
    return res.status(500).json({ error: err.message || "TTS failed" });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
//  [ VICIdial AGENTS MANAGEMENT ]  (Firestore + Node proxy to PHP )
// ───────────────────────────────────────────────────────────────────────────────

// Add a new VICIdial agent record in Firestore
app.post("/vcdial-agents", async (req, res) => {
  const { agentId, password } = req.body;
  if (!agentId || !password) {
    return res.status(400).json({ error: "Missing credentials" });
  }
  try {
    const exists = await db
      .collection("vcdial_agents")
      .where("agentId", "==", agentId)
      .get();
    if (!exists.empty) {
      return res.status(400).json({ error: "Agent already exists" });
    }
    const hashed = await hashPassword(password);
    const docRef = await db.collection("vcdial_agents").add({
      agentId,
      password: hashed,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    return res.status(201).json({ success: true, agent: { id: docRef.id, agentId } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Proxy endpoint: fetch agents from VICIdial's PHP script (HTTPS only)
app.get("/vcdial-agents", async (req, res) => {
  try {
    const response = await fetch("https://allegientlead.dialerhosting.com/get_vicidial_agents.php");
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from VICIdial PHP`);
    }
    const agentsData = await response.json();
    // Expect agentsData = [ { "user_id":"1001", "agent_login":"agent1", "agent_name":"John Smith" }, … ]
    return res.json(agentsData);
  } catch (err) {
    console.error("/vcdial-agents ERROR:", err.message);
    return res.status(500).json({
      error: "Failed to fetch agents from VICIdial PHP",
      details: err.message,
    });
  }
});

// Update a VICIdial agent record in Firestore
app.put("/vcdial-agents/:id", async (req, res) => {
  const { id } = req.params;
  const { agentId, password, companyName, agentLogin, isActive } = req.body;
  try {
    const updateData = { agentId, companyName, agentLogin, isActive };
    if (password) {
      updateData.password = await hashPassword(password);
    }
    await db.collection("vcdial_agents").doc(id).update(updateData);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a VICIdial agent record from Firestore
app.delete("/vcdial-agents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection("vcdial_agents").doc(id).delete();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
//  [ CAMPAIGNS + BOT ASSIGNMENT TO CAMPAIGN ]  (Node proxy + Firestore logic)
// ───────────────────────────────────────────────────────────────────────────────

// Proxy endpoint: fetch campaigns from VICIdial's PHP script (HTTPS only)
app.get("/campaigns", async (req, res) => {
  try {
    const response = await fetch("https://allegientlead.dialerhosting.com/get_campaigns.php");
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch campaigns from PHP API" });
    }
    const data = await response.json();
    // Expect data = [ { "campaign_id":"001", "campaign_name":"Demo Campaign" }, … ]
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Create or update a campaign-bot assignment in Firestore
app.post("/campaign-bot-assignments", async (req, res) => {
  const { campaignId, botId } = req.body;
  if (!campaignId || !botId) {
    return res.status(400).json({ error: "Campaign ID and Bot ID are required" });
  }

  try {
    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists || botDoc.data().isArchived) {
      return res.status(400).json({ error: "Bot invalid or archived" });
    }

    const prevAssignments = await db
      .collection("bot_assignments")
      .where("campaignId", "==", campaignId)
      .where("isActive", "==", true)
      .get();

    const batch = db.batch();
    prevAssignments.forEach((doc) =>
      batch.update(doc.ref, { isActive: false })
    );

    const newRef = db.collection("bot_assignments").doc();
    batch.set(newRef, {
      campaignId,
      botId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    await batch.commit();
    return res.status(201).json({ success: true, assignmentId: newRef.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
//  [ ASSIGN BOT TO AGENT AND CAMPAIGN IN VICIdial ]  (Node → Firestore + PHP)
// ───────────────────────────────────────────────────────────────────────────────
app.post("/assign-bot-to-agent-and-campaign", async (req, res) => {
  const { botId, campaignId, agentId } = req.body;
  if (!botId || !campaignId || !agentId) {
    return res
      .status(400)
      .json({ error: "botId, campaignId and agentId are required" });
  }

  try {
    // 1) Record assignment in Firestore
    await db.collection("bot_assignments").add({
      botId,
      campaignId,
      agentId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    // 2) Assign agent to VICIdial campaign via PHP (HTTPS)
    const phpAgentRes = await fetch(
      "https://allegientlead.dialerhosting.com/assign_agent_to_campaign.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, campaignId }),
      }
    );
    if (!phpAgentRes.ok) {
      const err = await phpAgentRes.json().catch(() => ({}));
      throw new Error(err.error || "Failed to assign agent in VICIdial");
    }

    // 3) Record bot assignment in VICIdial's MySQL via PHP (HTTPS)
    const phpBotRes = await fetch(
      "https://allegientlead.dialerhosting.com/update_bot_assignments.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, campaignId, agentId }),
      }
    );
    const bodyText = await phpBotRes.text();
    if (!phpBotRes.ok) {
      console.error("PHP bot assignment error:", bodyText);
      throw new Error(`Failed to insert bot assignment: ${bodyText}`);
    }
    const botResult = JSON.parse(bodyText);

    return res.json({ success: true, botResult });
  } catch (err) {
    console.error("Error assigning bot and agent:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
//  [ PROXY BOT ASSIGNMENTS JOINED WITH REMOTE AGENTS ]  (unused by React, but here)
// ───────────────────────────────────────────────────────────────────────────────
app.get("/bot-assignments", async (req, res) => {
  try {
    const qs = req.query.campaign_id
      ? `?campaign_id=${encodeURIComponent(req.query.campaign_id)}`
      : "";
    const phpRes = await fetch(
      `https://allegientlead.dialerhosting.com/get_bot_assignments.php${qs}`
    );
    if (!phpRes.ok) {
      const text = await phpRes.text();
      console.error("PHP error:", text);
      return res.status(500).json({ error: "Failed to fetch assignments" });
    }
    const data = await phpRes.json();
    return res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start a new bot session: returns first question and TTS audio
app.post("/start-bot-session", async (req, res) => {
  const { botId } = req.body;
  if (!botId) return res.status(400).json({ error: "botId required" });
  try {
    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists) return res.status(404).json({ error: "Bot not found" });
    const bot = botDoc.data();
    const script = bot.script || [];
    if (!Array.isArray(script) || script.length === 0) return res.status(400).json({ error: "Bot script is empty" });
    const voice = bot.voice || "en-US-Wavenet-F";
    // Synthesize first question
    const firstQuestion = script[0];
    const audioPath = await speakText(firstQuestion, voice);
    // Create session in Firestore
    const sessionRef = await db.collection("bot_sessions").add({
      botId,
      currentStep: 0,
      responses: [],
      createdAt: new Date().toISOString(),
      done: false
    });
    return res.json({
      sessionId: sessionRef.id,
      question: firstQuestion,
      audioPath: path.basename(audioPath),
      step: 0,
      done: false
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Respond to a bot session: process user audio, advance script, return next question/audio
app.post("/bot-session/:sessionId/respond", async (req, res) => {
  const { sessionId } = req.params;
  const userAudio = req.body; // Expect raw audio buffer (WAV)
  if (!userAudio || !Buffer.isBuffer(userAudio)) {
    return res.status(400).json({ error: "User audio (WAV buffer) required" });
  }
  try {
    const sessionRef = db.collection("bot_sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session not found" });
    const session = sessionDoc.data();
    if (session.done) return res.json({ done: true, message: "Session already completed", allResponses: session.responses });
    // Get bot script
    const botDoc = await db.collection("bots").doc(session.botId).get();
    if (!botDoc.exists) return res.status(404).json({ error: "Bot not found" });
    const bot = botDoc.data();
    const script = bot.script || [];
    const voice = bot.voice || "en-US-Wavenet-F";
    // Transcribe user audio
    recognizeLiveAudio(userAudio, script[session.currentStep], async (err, sttResult) => {
      if (err) return res.status(500).json({ error: "STT failed" });
      const userText = sttResult.text || "";
      // Optionally classify response
      const classification = classifyResponse(userText);
      // Save response
      const responses = session.responses.concat([{ step: session.currentStep, userText, classification }]);
      let nextStep = session.currentStep + 1;
      let done = nextStep >= script.length;
      let nextQuestion = done ? null : script[nextStep];
      let nextAudioPath = null;
      if (!done) {
        nextAudioPath = await speakText(nextQuestion, voice);
      }
      // Update session
      await sessionRef.update({
        currentStep: nextStep,
        responses,
        done
      });
      return res.json({
        step: nextStep,
        done,
        nextQuestion,
        audioPath: nextAudioPath ? path.basename(nextAudioPath) : null,
        classification,
        allResponses: responses
      });
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
//  Start Server
// ───────────────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Unified server running on port ${PORT}`);
});
