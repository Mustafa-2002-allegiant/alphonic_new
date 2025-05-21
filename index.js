// ✅ index.js — Unified Voicebot + Agent Management Server

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const { streamToVosk } = require("./sttClient");
const { speakText } = require("./TTSService");
const { recognizeLiveAudio } = require("./liveSTTHandler");
const classifyResponse = require("./classifyResponse");
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : require("./serviceAccountKey.json");

const app = express();
const PORT = process.env.PORT || 8080;

app.use("/audio", express.static(path.join(__dirname)));
app.use(cors());
app.use(express.json());

// 🔐 Firebase Init
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// ✅ All Bot, Agent, Company Routes — Unified

// ---- [ BOT ROUTES ] ----
app.post("/bot", async (req, res) => {
  const { botId, script, voice } = req.body;
  if (!botId || !script || !Array.isArray(script)) {
    return res.status(400).json({ error: "botId and script (array) required" });
  }
  try {
    await db.collection("bots").doc(botId).set({
      script,
      sessionProgress: { currentLine: 0 },
      isArchived: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      voice: voice || "en-US-Wavenet-F",
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to save bot", details: err.message });
  }
});

app.get("/active-bots", async (req, res) => {
  try {
    const snapshot = await db
      .collection("bots")
      .where("isActive", "==", true)
      .where("isArchived", "==", false)
      .get();
    const bots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(bots);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active bots", details: err.message });
  }
});

app.post("/test-voice", async (req, res) => {
  const { text, voice } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });
  try {
    await speakText(text, voice || "en-US-Wavenet-F");
    res.json({ success: true, message: "Voice test completed" });
  } catch (err) {
    res.status(500).json({ error: err.message || "TTS failed" });
  }
});

app.post("/start-bot", async (req, res) => {
  try {
    const audioBuffer = Buffer.from(req.body.audio, "base64");
    const lastBotMessage = req.body.lastLine || "Do you want to speak with a human?";
    recognizeLiveAudio(audioBuffer, lastBotMessage, async (err, result) => {
      if (err) return res.status(500).json({ error: "STT failed" });
      await db.collection("bot_sessions").add({ ...result, timestamp: new Date().toISOString() });
      res.json(result);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to process audio", details: err.message });
  }
});

// ---- [ AGENT ROUTES ] ----
app.post("/vcdial-agents", async (req, res) => {
  const { agentId, password } = req.body;
  if (!agentId || !password) return res.status(400).json({ error: "Missing credentials" });
  try {
    const exists = await db.collection("vcdial_agents").where("agentId", "==", agentId).get();
    if (!exists.empty) return res.status(400).json({ error: "Agent already exists" });
    const hashed = await hashPassword(password);
    const doc = await db.collection("vcdial_agents").add({
      agentId,
      password: hashed,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ success: true, agent: { id: doc.id, agentId } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/vcdial-agents", async (req, res) => {
  try {
    const snapshot = await db.collection("vcdial_agents").get();
    const agents = snapshot.docs.map((doc) => {
      const { password, ...rest } = doc.data();
      return { id: doc.id, ...rest };
    });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- [ COMPANY + BOT ASSIGNMENT ] ----
app.get("/companies", async (req, res) => {
  try {
    const snap = await db.collection("companies").get();
    res.json(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/bot-assignments", async (req, res) => {
  const { agentId, botId } = req.body;
  if (!agentId || !botId) return res.status(400).json({ error: "Agent ID and Bot ID are required" });
  try {
    const agentDoc = await db.collection("vcdial_agents").doc(agentId).get();
    if (!agentDoc.exists) return res.status(404).json({ error: "Agent not found" });
    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists || botDoc.data().isArchived) return res.status(400).json({ error: "Bot invalid or archived" });

    const prevAssignments = await db.collection("bot_assignments")
      .where("agentId", "==", agentId)
      .where("isActive", "==", true)
      .get();

    const batch = db.batch();
    prevAssignments.forEach(doc => batch.update(doc.ref, { isActive: false }));

    const newRef = db.collection("bot_assignments").doc();
    batch.set(newRef, {
      agentId,
      botId,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    await batch.commit();

    res.status(201).json({ success: true, assignmentId: newRef.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start ----
app.listen(PORT, () => {
  console.log(`🚀 Unified server running on port ${PORT}`);
});
