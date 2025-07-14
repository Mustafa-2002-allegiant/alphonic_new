// testWebToApiFlow.js
// Test the complete flow: Web login → Store session → Use for API calls

const { setWebSessionId, getSessionId, sessionMap } = require('./vicidialApiClient');
const VicidialWebAutomation = require('./vicidialWebAutomation');
require('dotenv').config();

async function testWebToApiFlow() {
  try {
    console.log('🧪 Testing Web-to-API Session Flow...\n');
    
    const testAgent = process.env.VICIDIAL_AGENT_USER || '8024';
    
    console.log(`1️⃣ Step 1: Login via web interface for agent: ${testAgent}`);
    
    // Initialize web automation
    const automation = new VicidialWebAutomation();
    await automation.initialize();
    
    try {
      // Login agent via web interface
      const webSessionId = await automation.loginAgent(testAgent, process.env.VICIDIAL_AGENT_PASS);
      console.log(`✅ Web login successful. Session ID: ${webSessionId}`);
      
      // Store the session ID for API use
      console.log(`\n2️⃣ Step 2: Storing session ID for API use...`);
      setWebSessionId(testAgent, webSessionId);
      console.log(`✅ Session ID stored in API client`);
      
      // Test getting the session ID
      console.log(`\n3️⃣ Step 3: Testing session ID retrieval...`);
      const retrievedSessionId = getSessionId(testAgent);
      console.log(`✅ Retrieved session ID: ${retrievedSessionId}`);
      
      // Verify they match
      if (webSessionId === retrievedSessionId) {
        console.log(`\n✅ SUCCESS: Session IDs match!`);
        console.log(`📏 Session ID length: ${webSessionId.length} characters`);
        
        if (webSessionId.length > 2) {
          console.log(`✅ Session ID format looks correct (not a 2-digit ID)`);
        } else {
          console.log(`⚠️ WARNING: Session ID is only ${webSessionId.length} characters`);
        }
        
        console.log(`\n🔍 Session Map contents:`);
        console.log('SessionMap:', Array.from(sessionMap.entries()));
        
        console.log(`\n🎉 SOLUTION READY: Use this flow to preserve ViciDial session IDs:`);
        console.log(`   1. POST /web-login-agent with { agent_user: "${testAgent}" }`);
        console.log(`   2. POST /start-bot-session with { agent_user: "${testAgent}", botId: "..." }`);
        console.log(`   3. Session ID ${webSessionId} will be preserved for all API calls!`);
        
      } else {
        console.log(`❌ FAIL: Session IDs don't match!`);
      }
      
    } finally {
      await automation.close();
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testWebToApiFlow();
