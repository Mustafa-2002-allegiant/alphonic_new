const vosk = require("vosk");
const fs = require("fs");
const { Readable } = require("stream");
const classifyResponse = require("./classifyResponse");

const MODEL_PATH = "model";
const SAMPLE_RATE = 16000;

if (!fs.existsSync(MODEL_PATH)) {
  throw new Error(`❌ Model not found at ${MODEL_PATH}`);
}

const model = new vosk.Model(MODEL_PATH);

function recognizeLiveAudio(audioBuffer, lastBotMessage, callback) {
  const recognizer = new vosk.Recognizer({ model: model, sampleRate: SAMPLE_RATE });
  const audioStream = Readable.from(audioBuffer);

  audioStream.on("data", (chunk) => {
    recognizer.acceptWaveform(chunk);
  });

  audioStream.on("end", () => {
    const finalResult = recognizer.finalResult();
    recognizer.free();

    const userText = finalResult.text;
    const intent = classifyResponse(userText);

    let action = "unrecognized";
    let message = "Sorry, I didn’t understand that.";

    if (intent === "yes") {
      action = "transfer_to_agent";
      message = "Transferring you to a live agent...";
    } else if (intent === "no") {
      action = "end_call";
      message = "Okay, ending the call. Have a great day!";
    } else if (intent === "repeat") {
      action = "repeat";
      message = lastBotMessage || "Let me repeat that for you.";
    }

    callback(null, {
      userText,
      intent,
      action,
      message,
    });
  });

  audioStream.on("error", (err) => {
    recognizer.free();
    callback(err);
  });
}

module.exports = { recognizeLiveAudio };
