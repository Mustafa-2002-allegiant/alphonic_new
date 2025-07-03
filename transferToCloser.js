const ami = require("./ami"); // your ami.js

/**
 * Transfers bot call to available human closer via VICIdial
 * @param {string} botChannel - e.g., SIP/8024
 * @param {string} campaignId - VICIdial campaign ID (default: "002")
 */
const transferToCloser = async (botChannel, campaignId = "002") => {
  if (!botChannel) {
    console.error("❌ Bot live channel is required.");
    return;
  }

  try {
    console.log(`🚀 Starting transferToCloser for channel: ${botChannel}, campaign: ${campaignId}`);

    // Step 1: Redirect bot to VICIdial MeetMe room (8300)
    const redirectAction = {
      Action: "Redirect",
      Channel: botChannel,
      Context: "default",
      Exten: "8300",
      Priority: 1,
    };

    console.log("🔄 Sending Redirect Action to AMI:", redirectAction);
    const redirectRes = await ami.action(redirectAction);
    console.log("✅ Redirect Response from AMI:", redirectRes);

    // Step 2: Originate call to a free closer in specified campaign
    const originateAction = {
      Action: "Originate",
      Channel: `Local/933*${campaignId}*CL_AGENT@default`,
      Context: "default",
      Exten: "8365",
      Priority: 1,
      CallerID: "BotTransfer <1000>",
      Timeout: 30000,
    };

    console.log("📞 Sending Originate Action to AMI:", originateAction);
    const originateRes = await ami.action(originateAction);
    console.log("✅ Originate Response from AMI:", originateRes);

    console.log("🎯 Transfer to closer completed successfully.");

  } catch (err) {
    console.error("❌ Transfer Failed:", err);
  }
};

module.exports = transferToCloser;
