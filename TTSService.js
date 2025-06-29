const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const util = require("util");
const path = require("path");

// Ensure the audio directory exists
const audioDir = path.join(__dirname, "audio");
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir);
}

// ✅ Load service account
const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : require("./serviceAccountKey.json");

const client = new textToSpeech.TextToSpeechClient({
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key
  }
});

// 🎤 Function to synthesize speech
async function speakText(text, voiceName = "en-US-Wavenet-D") {
  const request = {
    input: { text },
    voice: { languageCode: "en-US", name: voiceName },
    audioConfig: { audioEncoding: "MP3" }
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    // Return the audio buffer directly for immediate playback
    return response.audioContent;
  } catch (err) {
    console.error("TTS error:", err);
    return null;
  }
}

module.exports = { speakText };
