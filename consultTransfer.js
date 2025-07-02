const AmiClient = require("asterisk-ami-client");
const ami = new AmiClient();

ami.on("connect", () => console.log("✅ AMI connected"));
ami.on("event", (event) => console.log("📡 AMI EVENT:", event.Event));
ami.on("disconnect", () => console.log("⚠️ AMI disconnected"));
ami.on("error", (err) => console.error("❌ AMI ERROR:", err.message));

const originateConsultTransfer = async (customerNumber) => {
  try {
    await ami.connect("admin", "1234", {
      host: "138.201.82.40",
      port: 5038,
    });

    // STEP 1: Call a Closer from Campaign 002
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
    console.log("✅ Step 1: Closer call initiated", res1);

    // STEP 2: After delay, dial customer
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
      console.log("✅ Step 2: Customer call initiated", res2);
    }, 3000);
  } catch (err) {
    console.error("❌ Consultative Transfer Error:", err.message);
  }
};

module.exports = originateConsultTransfer;
