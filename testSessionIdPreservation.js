// testSessionIdPreservation.js
// Test script to verify that session IDs are preserved correctly

const { loginAgent } = require('./vicidialApiClient');
require('dotenv').config();

async function testSessionIdPreservation() {
  try {
    console.log('🧪 Testing Session ID Preservation...\n');
    
    // Test agent from your environment
    const testAgent = process.env.VICIDIAL_AGENT_USER || '8024';
    
    console.log(`1️⃣ Testing loginAgent for agent: ${testAgent}`);
    const sessionId1 = await loginAgent(testAgent);
    console.log(`✅ First login - Session ID: ${sessionId1}`);
    
    // Call loginAgent again to test caching
    console.log(`\n2️⃣ Testing cached session for agent: ${testAgent}`);
    const sessionId2 = await loginAgent(testAgent);
    console.log(`✅ Cached login - Session ID: ${sessionId2}`);
    
    // Check if session IDs match
    if (sessionId1 === sessionId2) {
      console.log(`\n✅ SUCCESS: Session IDs match (${sessionId1})`);
      console.log(`📏 Session ID length: ${sessionId1.length} characters`);
      
      // Check if it's a valid ViciDial session ID (should be longer than 2 digits)
      if (sessionId1.length > 2) {
        console.log(`✅ Session ID format looks correct (not a 2-digit ID)`);
      } else {
        console.log(`❌ WARNING: Session ID is only ${sessionId1.length} characters - this might be the problem!`);
      }
    } else {
      console.log(`❌ FAIL: Session IDs don't match!`);
      console.log(`   First:  ${sessionId1}`);
      console.log(`   Second: ${sessionId2}`);
    }
    
    console.log('\n🔍 Current session map contents:');
    const { sessionMap } = require('./vicidialApiClient');
    console.log('SessionMap:', Array.from(sessionMap.entries()));
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testSessionIdPreservation();
