const textToSpeech = require("@google-cloud/text-to-speech");
const fs = require("fs");
const util = require("util");
const path = require("path");

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

  const [response] = await client.synthesizeSpeech(request);

  const outputPath = path.join(__dirname, `audio/output_${Date.now()}.mp3`);
  const writeFile = util.promisify(fs.writeFile);
  await writeFile(outputPath, response.audioContent, "binary");

  return outputPath;
}

module.exports = { speakText };
