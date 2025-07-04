require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");
const bcrypt = require("bcryptjs");
const qs = require("querystring");

const db = require("./firebaseConfig");
const { speakText } = require("./TTSService");
const { recognizeLiveAudio } = require("./liveSTTHandler");
const classifyResponse = require("./classifyResponse");

const {
  callAgent,
  getRecordingStatus,
  externalDial,
  hangupCall,
  pauseAgent,
  setStatus,
  transferCall,
} = require("./vicidialApiClient");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/audio", express.static(path.join(__dirname, "audio")));

// Start a bot session (assign to agent + return TTS of first script line)
app.post("/start-bot-session", async (req, res) => {
  const { agent_user, botId } = req.body;
  if (!agent_user || !botId) return res.status(400).json({ error: "agent_user and botId required" });

  try {
    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists) return res.status(404).json({ error: "Bot not found" });

    await callAgent(agent_user);
    const status = await getRecordingStatus(agent_user); // just for debug/logging

    const script = botDoc.data().script || [];
    const voice = botDoc.data().voice || "en-US-Wavenet-F";

    const audioPath = await speakText(script[0], voice);

    const sessionRef = await db.collection("bot_sessions").add({
      botId,
      agent_user,
      currentStep: 0,
      responses: [],
      createdAt: new Date().toISOString(),
      done: false,
    });

    return res.json({
      sessionId: sessionRef.id,
      question: script[0],
      audioPath: path.basename(audioPath),
      step: 0
    });
  } catch (err) {
    console.error("❌ start-bot-session error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Respond to bot session and handle STT + classification
app.post("/bot-session/:sessionId/respond", async (req, res) => {
  const { sessionId } = req.params;
  const audioBuffer = req.body.audio;
  if (!audioBuffer) return res.status(400).json({ error: "audio required" });

  try {
    const sessionRef = db.collection("bot_sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session not found" });

    const session = sessionDoc.data();
    if (session.done) return res.json({ done: true, message: "Session complete" });

    const botDoc = await db.collection("bots").doc(session.botId).get();
    const bot = botDoc.data();
    const script = bot.script;
    const voice = bot.voice;

    recognizeLiveAudio(audioBuffer, script[session.currentStep], async (err, resultText) => {
      const classification = classifyResponse(resultText);
      const responses = session.responses.concat([{ step: session.currentStep, text: resultText, classification }]);

      let done = false;
      let message = "";
      let audioPath = null;

      if (classification === "yes") {
        await transferCall(session.agent_user, "8600051");
        message = "Transferring to live agent.";
        done = true;
      } else if (classification === "no") {
        await setStatus(session.agent_user, "A");
        await hangupCall(session.agent_user);
        message = "Ending call.";
        done = true;
      } else {
        const nextStep = session.currentStep + 1;
        if (nextStep >= script.length) {
          done = true;
          message = "Script complete.";
        } else {
          message = script[nextStep];
          audioPath = await speakText(message, voice);
        }

        await sessionRef.update({
          currentStep: nextStep,
          responses,
          done
        });
      }

      return res.json({
        classification,
        message,
        done,
        audioPath: audioPath ? path.basename(audioPath) : null
      });
    });
  } catch (err) {
    console.error("❌ bot-session response error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Start Express server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Cleaned VICIdial bot backend running on port ${PORT}`);
});
