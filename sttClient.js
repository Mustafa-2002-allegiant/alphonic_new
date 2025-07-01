const WebSocket = require("ws");
const { Readable } = require("stream");

function streamToVosk(audioBuffer, callback) {
  const ws = new WebSocket("ws://127.0.0.1:2700");

  ws.on("open", () => {
    const stream = Readable.from(audioBuffer);
    stream.on("data", (chunk) => {
      ws.send(chunk);
    });
    stream.on("end", () => {
      ws.send(JSON.stringify({ eof: 1 }));
    });
  });

  let finalTranscript = "";
  let responded = false;

  ws.on("message", (msg) => {
    if (responded) return;

    try {
      const data = JSON.parse(msg);
      if (data.text) {
        finalTranscript = data.text;
        responded = true;
        ws.close();
        callback(null, finalTranscript);
      }
    } catch (err) {
      if (!responded) {
        responded = true;
        callback(err);
      }
    }
  });

  ws.on("error", (err) => {
    if (!responded) {
      responded = true;
      callback(err);
    }
  });
}

module.exports = { streamToVosk };