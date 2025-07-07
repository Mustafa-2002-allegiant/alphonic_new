// ───────────────────────────────────────────────────────────────────────────────
// index.js
// ───────────────────────────────────────────────────────────────────────────────
require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const fetch     = require("node-fetch");
const qs        = require("querystring");
const { loginAgent, transferCall, callAgent } = require("./vicidialApiClient");

const db                   = require("./firebaseConfig");
const { speakText }        = require("./TTSService");
const { recognizeLiveAudio } = require("./liveSTTHandler");
const classifyResponse     = require("./classifyResponse");

const {
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

// debug endpoint
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


app.post("/start-bot-session", async (req, res) => {
  await loginAgent(agent_user);
  await transferCall(agent_user);
  await callAgent(agent_user);
  const { agent_user, botId } = req.body;
  if (!agent_user || !botId) {
    return res.status(400).json({ error: "agent_user and botId required" });
  }

  try {
    await transferCall(agent_user);
    await callAgent(agent_user);
    await getRecordingStatus(agent_user);

    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists) {
      return res.status(404).json({ error: "Bot not found" });
    }

    const script   = botDoc.data().script || [];
    const voice    = botDoc.data().voice  || "en-US-Wavenet-F";
    const audioPath = await speakText(script[0], voice);

    const sessionRef = await db.collection("bot_sessions").add({
      botId, agent_user,
      currentStep: 0,
      responses:   [],
      done:        false,
      createdAt:   new Date().toISOString()
    });

    res.json({
      sessionId: sessionRef.id,
      question:  script[0],
      audioPath: path.basename(audioPath),
      step:      0
    });
  } catch (err) {
    console.error("❌ start-bot-session error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/bot-session/:sessionId/respond", async (req, res) => {
  const { sessionId } = req.params;
  const audioBuffer   = req.body.audio;
  if (!audioBuffer) return res.status(400).json({ error: "audio required" });

  try {
    const sessionRef = db.collection("bot_sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) {
      return res.status(404).json({ error: "Session not found" });
    }

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Cleaned VICIdial bot backend running on port ${PORT}`);
});
