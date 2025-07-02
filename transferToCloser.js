const ami = require("./ami"); // your ami.js

/**
 * Transfers bot call to available human closer via VICIdial
 * @param {string} botChannel - e.g., SIP/8024
 * @param {string} campaignId - default: "002"
 */
const transferToCloser = async (botChannel, campaignId = "002") => {
  if (!botChannel) {
    console.error("❌ Bot live channel is required.");
    return;
  }

  try {
    // Step 1: Redirect bot into VICIdial MeetMe room (8300)
    const redirectAction = {
      Action: "Redirect",
      Channel: botChannel,
      Context: "default",
      Exten: "8300",
      Priority: 1,
    };

    const redirectRes = await ami.action(redirectAction);
    console.log("📥 Moved bot to MeetMe:", redirectRes);

    // Step 2: Originate call to closer in campaign
    const originateAction = {
      Action: "Originate",
      Channel: `Local/933*${campaignId}*CL_AGENT@default`,
      Context: "default",
      Exten: "8365",
      Priority: 1,
      CallerID: "BotTransfer <1000>",
      Timeout: 30000,
    };

    const originateRes = await ami.action(originateAction);
    console.log("📞 Originated closer into MeetMe:", originateRes);

  } catch (err) {
    console.error("❌ Transfer Failed:", err);
  }
};

module.exports = transferToCloser;
