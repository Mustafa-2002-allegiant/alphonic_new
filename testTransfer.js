const fetch = require("node-fetch");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Insecure, for testing only

const formData = new URLSearchParams({
  source: "api",
  user: "8024",           // Replace with valid agent or API user
  pass: "hello123", // Replace with actual password
  function: "transfer_conference",
  session_id: "8600055",  // Must be a real live session
  server_ip: "138.201.82.40",
  campaign_id: "002",
  phone_code: "1",
  preset_name: "XFER",     // Or "LOCAL CLOSER" (check your presets)
  closer_group: "Closers", // Replace with actual group
  agent_user: "8024",      // Must be a valid logged-in agent
  format: "text"
});

fetch("https://138.201.82.40/agc/api.php", {
  method: "POST",
  body: formData,
  headers: {
    "Content-Type": "application/x-www-form-urlencoded"
  }
})
  .then((res) => res.text())
  .then((text) => {
    console.log("📞 Local Closer Transfer Response:", text);
  })
  .catch((err) => {
    console.error("❌ Fetch Error:", err);
  });
