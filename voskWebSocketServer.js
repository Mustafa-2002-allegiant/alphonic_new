// WebSocket STT Server (voskWebSocketServer.js)
// Run this separately with: node voskWebSocketServer.js

const path = require("path");



const fs = require('fs');
const vosk = require('vosk');
const WebSocket = require('ws');
const { Readable } = require('stream');


const MODEL_PATH = path.resolve(__dirname, "model/vosk-model-small-en-us-0.15");
const SAMPLE_RATE = 16000;

if (!fs.existsSync(MODEL_PATH)) {
  console.error("Model path not found:", MODEL_PATH);
  process.exit(1);
}

const model = new vosk.Model(MODEL_PATH);
const wss = new WebSocket.Server({ port: 2700 });

wss.on("connection", function connection(ws) {
  const recognizer = new vosk.Recognizer({ model, sampleRate: SAMPLE_RATE });

  ws.on("message", function incoming(data) {
    recognizer.acceptWaveform(data);
    const result = recognizer.result();
    if (result.text) {
      ws.send(JSON.stringify(result));
    }
  });

  ws.on("close", function () {
    recognizer.free();
  });
});

console.log("🧠 Vosk WebSocket server running on ws://localhost:2700");