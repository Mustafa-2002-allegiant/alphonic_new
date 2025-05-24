const admin = require("firebase-admin");
const fetch = require("node-fetch");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const PHP_API_URL = "https://allegientlead.dialerhosting.com/update_bot_assignment.php";

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
    }
  } catch (err) {
    console.error("Sync error:", err);
  }
}

syncBots();
