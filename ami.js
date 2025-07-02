const AmiClient = require("asterisk-ami-client");

const ami = new AmiClient({
  reconnect: true,
  keepAlive: true,
});

ami.connect("admin", "1234", {
  host: "138.201.82.40",
  port: 5038,
})
  .then(() => console.log("✅ AMI Connected to VICIdial"))
  .catch(err => console.error("❌ AMI Connection Error:", err));

module.exports = ami;
