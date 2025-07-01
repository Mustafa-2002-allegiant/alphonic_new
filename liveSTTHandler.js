const vosk = require("vosk");
const fs = require("fs");
const { Readable } = require("stream");
const path = require("path");

const MODEL_PATH = path.resolve(__dirname, "model/vosk-model-small-en-us-0.15");
const SAMPLE_RATE = 16000;

if (!fs.existsSync(MODEL_PATH)) {
  throw new Error(`❌ Model not found at ${MODEL_PATH}`);
}

const model = new vosk.Model(MODEL_PATH);

function recognizeLiveAudio(audioBuffer, callback) {
  const recognizer = new vosk.Recognizer({ model: model, sampleRate: SAMPLE_RATE });
  const audioStream = Readable.from(audioBuffer);

  audioStream.on("data", (chunk) => {
    recognizer.acceptWaveform(chunk);
  });

  audioStream.on("end", () => {
    const finalResult = recognizer.finalResult();
    recognizer.free();
    callback(null, finalResult.text); // ✅ just return text, no intent logic here
  });

  audioStream.on("error", (err) => {
    recognizer.free();
    callback(err);
  });
}

module.exports = { recognizeLiveAudio };
