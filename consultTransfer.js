// consultTransfer.js
const AmiClient = require("asterisk-ami-client");

const ami = new AmiClient();

/**
 * Initiates consultative transfer between Closer (002) and the current customer
 * @param {string} customerNumber - phone number of the current customer
 */
const originateConsultTransfer = async (customerNumber) => {
  try {
    await ami.connect("admin", "1234", {
      host: "138.201.82.40",
      port: 5038,
    });

    console.log("✅ Connected to AMI");

    // Step 1: Dial Closer Group (Campaign 002)
    const closerDial = {
      Action: "Originate",
      Channel: "Local/999*Closers@default",
      Context: "default",
      Exten: "999*Closers",
      Priority: 1,
      CallerID: "BotBridge <1000>",
      Async: true,
    };

    const res1 = await ami.action(closerDial);
    console.log("📞 Step 1: Dialing Closer Group", res1);

    // Step 2: Wait 3s, then call customer
    setTimeout(async () => {
      const customerDial = {
        Action: "Originate",
        Channel: `Local/${customerNumber}@default`,
        Context: "default",
        Exten: customerNumber,
        Priority: 1,
        CallerID: "BotBridge <1000>",
        Async: true,
      };

      const res2 = await ami.action(customerDial);
      console.log("📞 Step 2: Dialing Customer", res2);
    }, 3000);
  } catch (err) {
    console.error("❌ Consultative Transfer Error:", err);
  }
};

module.exports = originateConsultTransfer;
