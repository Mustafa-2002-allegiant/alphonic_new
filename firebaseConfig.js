// firebaseConfig.js
const admin = require("firebase-admin");

const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  : require("./serviceAccountKey.json"); // your Firebase service account JSON file in root

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  // Optional: databaseURL if needed
  // databaseURL: "https://your-project-id.firebaseio.com",
});

const db = admin.firestore();

module.exports = db;
