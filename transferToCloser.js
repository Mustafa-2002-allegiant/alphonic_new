const Ami = require('asterisk-ami');

// Initialize AMI client
const ami = new Ami({
  host: '138.201.82.40',
  port: 5038,
  username: 'admin',
  password: '1234',
});

const ensureAmiConnection = async () => {
  try {
    if (!ami.isConnected()) {
      await ami.connect();
      console.log("✅ AMI Connected");
    }
  } catch (err) {
    console.error("❌ AMI Connection Error:", err);
  }
};

/**
 * Transfers bot call to available human closer via VICIdial
 * @param {string} botChannel - e.g., SIP/8024 or SIP/telecast-000xxxx
 * @param {string} campaignId - VICIdial campaign (default: 002)
 */
const transferToCloser = async (botChannel, campaignId = "002") => {
  if (!botChannel) {
    console.error("❌ Bot live channel is required.");
    return;
  }

  try {
    await ensureAmiConnection();

    // Step 1: Move current bot call into VICIdial conference (8300)
    const redirectAction = {
      Action: "Redirect",
      Channel: botChannel,
      Context: "default",
      Exten: "8300",
      Priority: 1,
    };

    const redirectRes = await ami.sendAction(redirectAction);
    console.log("📥 Moved bot to MeetMe:", redirectRes);

    // Step 2: Originate call to any available closer in campaign 002
    const originateAction = {
      Action: "Originate",
      Channel: `Local/933*${campaignId}*CL_AGENT@default`,
      Context: "default",
      Exten: "8365",
      Priority: 1,
      CallerID: "BotTransfer <1000>",
      Timeout: 30000,
    };

    const originateRes = await ami.sendAction(originateAction);
    console.log("📞 Originated closer into MeetMe:", originateRes);

  } catch (err) {
    console.error("❌ Transfer Failed:", err);
  }
};

module.exports = transferToCloser;
