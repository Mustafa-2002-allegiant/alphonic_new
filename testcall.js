const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const originateConsultTransfer = require("./consultTransfer");

app.use(bodyParser.json()); // for JSON input

// Local test route
app.post("/test-consult-transfer", async (req, res) => {
  const { number } = req.body;

  if (!number) {
    return res.status(400).json({ error: "Missing customer number" });
  }

  try {
    await originateConsultTransfer(number);
    res.json({ status: "Transfer initiated", number });
  } catch (err) {
    res.status(500).json({ error: "Transfer failed", details: err.message });
  }
});

const PORT = 8080;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
