const admin = require("firebase-admin");
const fetch = require("node-fetch");
const Ami = require('asterisk-ami');
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const PHP_API_URL = "https://allegientlead.dialerhosting.com/update_bot_assignment.php";

// Initialize AMI connection
const ami = new Ami({
  host: '138.201.82.40',  // Replace with your VICIdial server IP
  port: 5038,                  // AMI port
  username: 'admin',           // AMI username
  password: '1234'  // AMI password
});

// Function to handle AMI reconnection if connection drops
const ensureAmiConnection = async () => {
  try {
    if (!ami.isConnected()) {
      await ami.connect();
      console.log("Reconnected to AMI");
    }
  } catch (err) {
    console.error("Error connecting to AMI:", err);
  }
};

async function syncBots() {
  try {
    const assignmentsSnapshot = await db
      .collection("bot_assignments")
      .where("isActive", "==", true)
      .get();

    if (assignmentsSnapshot.empty) {
      console.log("No active bot assignments.");
      return;
    }

    for (const assignmentDoc of assignmentsSnapshot.docs) {
      const assignment = assignmentDoc.data();
      const { botId, campaignId } = assignment;

      if (!botId || !campaignId) {
        console.error("Failed to update bot assignment: Missing botId or campaignId");
        continue;
      }

      // Call PHP API to update VICIdial DB and assign bot as campaign agent
      try {
        const res = await fetch(PHP_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botId, campaignId }),
        });

        const result = await res.json();
        if (!res.ok || result.error) {
          console.error("Failed to update bot assignment:", result.error || result);
        } else {
          console.log(`Synced bot ${botId} to campaign ${campaignId}: ${result.message}`);
        }
      } catch (err) {
        console.error("Error calling PHP API to update bot assignment:", err);
        continue;  // Skip to next assignment
      }

      // Originate call to bot (remote agent)
      await originateCallToBot(botId, campaignId);
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
}

// Function to originate an outbound call to the bot (remote agent)
const originateCallToBot = async (botId, campaignId) => {
  try {
    // Ensure AMI connection is alive
    await ensureAmiConnection();

    const action = {
      Action: 'Originate',
      Channel: `SIP/${botId}`, // Bot's extension
      Context: 'default',
      Exten: '1234', // Phone number to dial
      Priority: 1,
      CallerID: 'Bot',
      Timeout: 30000
    };

    const response = await ami.sendAction(action);
    console.log(`Outbound call initiated to bot ${botId}: ${response}`);
    return response;
  } catch (err) {
    console.error('Error initiating call to bot:', err);
  }
};

// Start sync process
syncBots();
