// ✅ TTSService.mock.js — Fake voice playback for dev
async function speakText(text, voice = "mock-voice") {
    console.log(`🗣️ [MOCK] Speaking with voice "${voice}": ${text}`);
  }
  module.exports = { speakText };
  