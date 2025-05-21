const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const { admin, db } = require("./firebase");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// Get all companies
app.get("/companies", async (req, res) => {
  try {
    const snapshot = await db.collection("companies").get();
    const companies = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch companies", details: err.message });
  }
});

// Create new VCdial agent
app.post("/vcdial-agents", async (req, res) => {
  const { agentId, password, agentLogin, companyName, isNewCompany } = req.body;

  if (!agentId || !password || !agentLogin || !companyName) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const batch = db.batch();
    const existing = await db.collection("vcdial_agents").where("agentId", "==", agentId).get();
    if (!existing.empty) return res.status(400).json({ error: "Agent already exists" });

    let companyRef;
    if (isNewCompany) {
      const existingCompany = await db.collection("companies").where("name", "==", companyName).get();
      if (!existingCompany.empty) return res.status(400).json({ error: "Company already exists" });

      companyRef = db.collection("companies").doc();
      batch.set(companyRef, {
        name: companyName,
        agentLogin,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const companySnapshot = await db.collection("companies").where("name", "==", companyName).get();
      if (companySnapshot.empty) return res.status(400).json({ error: "Company not found" });
      companyRef = companySnapshot.docs[0].ref;
    }

    const hashedPassword = await hashPassword(password);
    const agentRef = db.collection("vcdial_agents").doc();
    batch.set(agentRef, {
      agentId,
      password: hashedPassword,
      companyName,
      agentLogin,
      companyRef: companyRef.id,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      passwordLastChanged: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.status(201).json({
      success: true,
      message: "Agent created",
      agent: {
        id: agentRef.id,
        agentId,
        companyName,
        agentLogin,
        isActive: true,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
});

// Get all VCdial agents
app.get("/vcdial-agents", async (req, res) => {
  try {
    const snapshot = await db.collection("vcdial_agents").get();
    const agents = snapshot.docs.map((doc) => {
      const { password, ...agentData } = doc.data();
      return { id: doc.id, ...agentData };
    });
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single VCdial agent
app.get("/vcdial-agents/:agentId", async (req, res) => {
  try {
    const docSnap = await db.collection("vcdial_agents").doc(req.params.agentId).get();
    if (!docSnap.exists) return res.status(404).json({ error: "Agent not found" });

    const { password, ...agentData } = docSnap.data();
    res.json({ id: docSnap.id, ...agentData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update VCdial agent
app.put("/vcdial-agents/:agentId", async (req, res) => {
  const { agentId, password, companyName, agentLogin, isActive } = req.body;
  if (!agentId || !companyName || !agentLogin) {
    return res.status(400).json({ error: "Agent ID, Company Name, and Agent Login are required" });
  }

  try {
    const agentRef = db.collection("vcdial_agents").doc(req.params.agentId);
    const docSnap = await agentRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Agent not found" });

    const batch = db.batch();
    const companySnapshot = await db.collection("companies").where("name", "==", companyName).get();

    let companyRef;
    if (companySnapshot.empty) {
      companyRef = db.collection("companies").doc();
      batch.set(companyRef, {
        name: companyName,
        agentLogin,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      companyRef = companySnapshot.docs[0].ref;
      const companyData = companySnapshot.docs[0].data();
      if (companyData.agentLogin !== agentLogin) {
        batch.update(companyRef, {
          agentLogin,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    const updateData = {
      agentId,
      companyName,
      agentLogin,
      companyRef: companyRef.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) {
      updateData.password = await hashPassword(password);
      updateData.passwordLastChanged = admin.firestore.FieldValue.serverTimestamp();
    }

    batch.update(agentRef, updateData);
    await batch.commit();

    res.json({ success: true, message: "Agent updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete VCdial agent
app.delete("/vcdial-agents/:agentId", async (req, res) => {
  try {
    const agentRef = db.collection("vcdial_agents").doc(req.params.agentId);
    const docSnap = await agentRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: "Agent not found" });

    await agentRef.delete();
    res.json({ success: true, message: "Agent deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Authenticate VCdial agent
app.post("/vcdial-agents/authenticate", async (req, res) => {
  const { agentId, password } = req.body;
  if (!agentId || !password) {
    return res.status(400).json({ error: "agentId and password are required" });
  }

  try {
    const snapshot = await db.collection("vcdial_agents").where("agentId", "==", agentId).get();
    if (snapshot.empty) return res.status(401).json({ error: "Invalid credentials" });

    const agentDoc = snapshot.docs[0];
    const agentData = agentDoc.data();
    const isMatch = await comparePassword(password, agentData.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const { password: _, ...agentInfo } = agentData;
    res.json({
      success: true,
      message: "Authentication successful",
      agent: { id: agentDoc.id, ...agentInfo },
    });
  } catch (err) {
    res.status(500).json({ error: "Authentication failed", details: err.message });
  }
});

// Get active bots
app.get("/active-bots", async (req, res) => {
  try {
    const snapshot = await db
      .collection("bots")
      .where("isActive", "==", true)
      .where("isArchived", "==", false)
      .get();
    const bots = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(bots);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active bots", details: err.message });
  }
});

// Assign bot to agent
app.post("/bot-assignments", async (req, res) => {
  const { agentId, botId } = req.body;
  if (!agentId || !botId) return res.status(400).json({ error: "Agent ID and Bot ID are required" });

  try {
    const agentDoc = await db.collection("vcdial_agents").doc(agentId).get();
    if (!agentDoc.exists) return res.status(404).json({ error: "Agent not found" });

    const botDoc = await db.collection("bots").doc(botId).get();
    if (!botDoc.exists || botDoc.data().isArchived) {
      return res.status(400).json({ error: "Bot is not active or has been archived" });
    }

    const existingAssignments = await db
      .collection("bot_assignments")
      .where("agentId", "==", agentId)
      .where("isActive", "==", true)
      .get();

    const batch = db.batch();
    existingAssignments.forEach((doc) => {
      batch.update(doc.ref, {
        isActive: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const assignmentRef = db.collection("bot_assignments").doc();
    batch.set(assignmentRef, {
      agentId,
      botId,
      agentData: {
        id: agentId,
        agentId: agentDoc.data().agentId,
        companyName: agentDoc.data().companyName,
      },
      botData: { id: botId, name: botDoc.data().name || `Bot ${botId}` },
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.status(201).json({
      success: true,
      message: "Bot assigned to agent successfully",
      assignment: { id: assignmentRef.id, agentId, botId, createdAt: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to assign bot", details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ App server running on port ${PORT}`);
});
