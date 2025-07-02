const AmiClient = require("asterisk-ami-client");
const ami = new AmiClient();

ami.on("connect", () => console.log("✅ AMI connected"));
ami.on("event", (event) => console.log("📡 AMI EVENT:", event.Event));
ami.on("disconnect", () => console.log("⚠️ AMI disconnected"));
ami.on("error", (err) => console.error("❌ AMI ERROR:", err.message));

const originateConsultTransfer = async () => {
    const action = {
      Action: 'Originate',
      Channel: 'Local/933*002*CL_AGENT@default',  // Format: 933*<CAMPAIGN>*CL_AGENT
      Context: 'default',
      Exten: '8365',       // VICIdial internal exten for "meetme"
      Priority: 1,
      CallerID: 'BotTransfer <1000>',
      Timeout: 30000
    };
  
    ami.action(action, (err, res) => {
      if (err) {
        console.error("❌ AMI Transfer failed:", err);
      } else {
        console.log("✅ AMI transfer initiated:", res);
      }
    });
  };
  

module.exports = originateConsultTransfer;
