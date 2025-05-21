// ✅ liveSTTHandler.mock.js — Fake speech recognition
function recognizeLiveAudio(audioBuffer, lastBotLine, callback) {
    console.log(`🎤 [MOCK] Recognizing audio... (Pretending user said: "yes")`);
    const fakeResult = {
      intent: "yes",
      confidence: 0.97,
      transcript: "yes please transfer me to a human",
      action: "transfer_to_agent",
    };
    callback(null, fakeResult);
  }
  
  module.exports = { recognizeLiveAudio };
  