// consultTransfer.js

const AmiClient = require("asterisk-ami-client");
const ami = new AmiClient();

ami.connect("admin", "1234", { host: "138.201.82.40", port: 5038 });

ami.on("connect", () => {
  console.log("✅ AMI Connected to VICIdial");
});

ami.on("disconnect", () => {
  console.warn("⚠️ AMI Disconnected");
});

ami.on("error", (err) => {
  console.error("❌ AMI Error:", err.message);
});

/**
 * Perform consultative transfer from bot to available closer on campaign 002
 * @param {string} liveChannel - Bot's active SIP channel (e.g., "SIP/8024" or "SIP/telecast-00013813")
 */
const originateConsultTransfer = async (liveChannel) => {
  try {
    if (!liveChannel) throw new Error("Live channel is required");

    // Step 1: Redirect current bot-customer call to conference (8300)
    const redirectAction = {
      Action: "Redirect",
      Channel: liveChannel,
      Context: "default",
      Exten: "8300", // VICIdial default conference
      Priority: 1,
    };

    const res1 = await ami.action(redirectAction);
    console.log("📥 Customer transferred to MeetMe:", res1);

    // Step 2: Originate agent to same conference via 8365
    const originateAction = {
      Action: "Originate",
      Channel: "Local/933*002*CL_AGENT@default", // Campaign 002 closers
      Context: "default",
      Exten: "8365",
      Priority: 1,
      CallerID: "BotTransfer <1000>",
      Timeout: 30000,
    };

    const res2 = await ami.action(originateAction);
    console.log("📞 Agent originated into conference:", res2);
  } catch (err) {
    console.error("❌ Transfer Error:", err.message);
  }
};

module.exports = originateConsultTransfer;
