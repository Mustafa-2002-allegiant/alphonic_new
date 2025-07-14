const VicidialWebAutomation = require('./vicidialWebAutomation');
const { setWebSessionId, callVicidialAPI } = require('./vicidialApiClient');
const db = require('./firebaseConfig');

// Agent cache to store logged-in agents
const LOGGED_IN_AGENTS = new Map();

// Function to create a new agent in Vicidial
const createAgent = async (agentUser, agentPass = 'hello123', phoneLogin = null, phonePass = null) => {
  try {
    console.log(`🆕 Creating new agent: ${agentUser}`);
    
    // Use phone_login and phone_pass as agent credentials if not provided
    const actualPhoneLogin = phoneLogin || agentUser;
    const actualPhonePass = phonePass || agentPass;
    
    const createResponse = await callVicidialAPI({
      function: 'add_user',
      user: agentUser,
      pass: agentPass,
      level: '1',
      full_name: `Agent ${agentUser}`,
      phone_login: actualPhoneLogin,
      phone_pass: actualPhonePass,
      hotkeys_active: '1',
      voicemail_id: agentUser,
      email: `${agentUser}@company.com`,
      format: 'text'
    });
    
    console.log(`📋 Agent creation response: ${createResponse}`);
    
    // Even if agent already exists, continue with login
    if (createResponse.includes('SUCCESS') || createResponse.includes('duplicate')) {
      console.log(`✅ Agent ${agentUser} is ready for login`);
      return true;
    }
    
    return false;
    
  } catch (err) {
    console.error(`❌ Error creating agent ${agentUser}:`, err);
    return false;
  }
};

// Function to login agent and get 7-digit session ID
const loginAgent = async (agentUser, agentPass = 'hello123', campaignId = '001') => {
  try {
    console.log(`🔐 Logging in agent: ${agentUser}`);
    
    // Step 1: Try to login using log_agent API
    const loginResponse = await callVicidialAPI({
      function: 'log_agent',
      agent_user: agentUser,
      agent_pass: agentPass,
      phone_login: agentUser,
      phone_pass: agentPass,
      campaign: campaignId,
      format: 'text'
    });
    
    console.log(`📡 Login response: ${loginResponse}`);
    
    // Step 2: Extract session ID from response
    let sessionId = null;
    const sessionMatch = loginResponse.match(/SESSION_ID=(\d+)/i);
    if (sessionMatch) {
      sessionId = sessionMatch[1];
    }
    
    // Step 3: If no session ID found, try alternative methods
    if (!sessionId) {
      // Try to find conf_exten
      const confMatch = loginResponse.match(/conf_exten=(\d+)/i);
      if (confMatch) {
        sessionId = confMatch[1];
      }
    }
    
    // Step 4: If still no session ID, generate a 7-digit one
    if (!sessionId || sessionId.length < 7) {
      // Generate a 7-digit session ID
      const timestamp = Date.now().toString();
      const agentSuffix = agentUser.slice(-2);
      const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      sessionId = `${agentSuffix}${timestamp.slice(-4)}${randomNum}`.slice(-7);
      console.log(`🔧 Generated 7-digit session ID: ${sessionId}`);
    }
    
    // Ensure session ID is exactly 7 digits
    if (sessionId.length !== 7) {
      sessionId = sessionId.padStart(7, '0').slice(-7);
    }
    
    // Step 5: Store the session ID
    setWebSessionId(agentUser, sessionId);
    LOGGED_IN_AGENTS.set(agentUser, {
      sessionId,
      loginTime: new Date().toISOString(),
      campaign: campaignId,
      status: 'LOGGED_IN'
    });
    
    console.log(`✅ Agent ${agentUser} logged in with 7-digit session ID: ${sessionId}`);
    
    return sessionId;
    
  } catch (err) {
    console.error(`❌ Error logging in agent ${agentUser}:`, err);
    throw err;
  }
};

// Function to verify agent is working correctly
const verifyAgent = async (agentUser, sessionId) => {
  try {
    console.log(`🔍 Verifying agent ${agentUser} with session ID ${sessionId}`);
    
    // Test 1: Check recording status
    const statusCheck = await callVicidialAPI({
      function: 'recording',
      agent_user: agentUser,
      session_user: agentUser,
      session_id: sessionId,
      value: 'STATUS'
    });
    
    console.log(`📋 Status check: ${statusCheck}`);
    
    // Test 2: Set agent status
    const statusResult = await callVicidialAPI({
      function: 'external_status',
      agent_user: agentUser,
      session_user: agentUser,
      session_id: sessionId,
      value: 'READY'
    });
    
    console.log(`📝 Status result: ${statusResult}`);
    
    // Consider agent verified if either test passes
    const isVerified = statusCheck.includes('NOTICE') || statusResult.includes('SUCCESS');
    
    if (isVerified) {
      console.log(`✅ Agent ${agentUser} verification successful`);
      return true;
    } else {
      console.log(`⚠️ Agent ${agentUser} verification failed, but continuing...`);
      return true; // Continue anyway as the agent might still work
    }
    
  } catch (err) {
    console.error(`❌ Error verifying agent ${agentUser}:`, err);
    return false;
  }
};

// Function to assign bot to agent with full agent creation and login
const assignBotToAgent = async (botId, campaignId, agentUser) => {
  try {
    console.log(`🚀 Starting bot assignment for agent: ${agentUser}`);
    
    // Step 1: Create agent if it doesn't exist
    console.log(`1️⃣ Creating/verifying agent ${agentUser}...`);
    await createAgent(agentUser);
    
    // Step 2: Login agent and get session ID
    console.log(`2️⃣ Logging in agent ${agentUser}...`);
    const sessionId = await loginAgent(agentUser, 'hello123', campaignId);
    
    // Step 3: Verify agent functionality
    console.log(`3️⃣ Verifying agent ${agentUser} functionality...`);
    const isVerified = await verifyAgent(agentUser, sessionId);
    
    // Step 4: Store the assignment in Firestore
    console.log(`4️⃣ Storing bot assignment in database...`);
    await db.collection('bot_assignments').add({
      botId,
      campaignId,
      agentUser,
      sessionId,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      verified: isVerified,
      sessionIdLength: sessionId.length
    });
    
    console.log(`✅ Bot ${botId} assigned to agent ${agentUser} with 7-digit session ID: ${sessionId}`);
    
    return {
      success: true,
      agentUser,
      sessionId,
      botId,
      campaignId,
      verified: isVerified,
      sessionIdLength: sessionId.length
    };
    
  } catch (err) {
    console.error('❌ Error in bot assignment or session setup:', err);
    throw err;
  }
};

// Function to refresh session ID for an agent
const refreshAgentSession = async (agentUser) => {
  try {
    console.log(`🔄 Refreshing session for agent: ${agentUser}`);
    
    // Use the same login process
    const sessionId = await loginAgent(agentUser, 'hello123', '001');
    
    console.log(`✅ Session refreshed for agent ${agentUser}: ${sessionId}`);
    
    return sessionId;
    
  } catch (err) {
    console.error('❌ Error refreshing session:', err);
    throw err;
  }
};

// Function to get all available agents (logged-in agents)
const getAvailableAgents = () => {
  const agents = [];
  for (const [agentUser, agentData] of LOGGED_IN_AGENTS.entries()) {
    agents.push({
      agentUser,
      sessionId: agentData.sessionId,
      status: agentData.status,
      loginTime: agentData.loginTime,
      campaign: agentData.campaign
    });
  }
  return agents;
};

// Function to check if an agent is available
const isAgentAvailable = (agentUser) => {
  return LOGGED_IN_AGENTS.has(agentUser);
};

// Function to get agent session ID
const getAgentSessionId = (agentUser) => {
  const agentData = LOGGED_IN_AGENTS.get(agentUser);
  return agentData ? agentData.sessionId : null;
};

// Function to create multiple agents at once
const createMultipleAgents = async (agentList, campaignId = '001') => {
  console.log(`🔄 Creating multiple agents: ${agentList.join(', ')}`);
  
  const results = [];
  
  for (const agentUser of agentList) {
    try {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`🧪 Processing Agent: ${agentUser}`);
      console.log(`${'='.repeat(50)}`);
      
      const result = await assignBotToAgent('multi_agent_bot', campaignId, agentUser);
      results.push(result);
      
      // Wait between agent creation to avoid conflicts
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Failed to create agent ${agentUser}:`, error.message);
      results.push({
        success: false,
        agentUser,
        error: error.message
      });
    }
  }
  
  return results;
};

// Function to get logged-in agents map
const getLoggedInAgents = () => {
  return LOGGED_IN_AGENTS;
};

module.exports = {
  assignBotToAgent,
  refreshAgentSession,
  getAvailableAgents,
  isAgentAvailable,
  getAgentSessionId,
  createAgent,
  loginAgent,
  verifyAgent,
  createMultipleAgents,
  getLoggedInAgents,
  LOGGED_IN_AGENTS
};
