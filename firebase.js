// firebase.js
const admin = require("firebase-admin");

// Load the JSON string from env-var and parse it:
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
} catch (err) {
  console.error("⚠️  Missing or invalid GOOGLE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://voicebotai-39243.firebaseio.com"  // keep your URL here
});

// Export the Firestore instance (and admin if you need it elsewhere)
const db = admin.firestore();

module.exports = { admin, db };
