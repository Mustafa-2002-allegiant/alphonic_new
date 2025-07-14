// testCallHandling.js
const { assignBotToAgent, refreshAgentSession, getAvailableAgents } = require('./assignBotToCampaign');
const { 
  getSessionId, 
  callAgent, 
  hangupCall, 
  setStatus, 
  transferCall, 
  getRecordingStatus 
} = require('./vicidialApiClient');

async function testCallHandling() {
  console.log('🧪 Starting Call Handling Test...\n');
  
  try {
    // Step 1: Test agent assignment with automatic login
    console.log('1️⃣ Testing agent assignment with automatic login...');
    const testAgent = '8024';
    const testBot = 'test_bot_1';
    const testCampaign = '001';
    
    const assignment = await assignBotToAgent(testBot, testCampaign, testAgent);
    console.log('✅ Assignment result:', assignment);
    
    // Step 2: Test session ID retrieval
    console.log('\n2️⃣ Testing session ID retrieval...');
    const sessionId = getSessionId(testAgent);
    console.log(`✅ Retrieved session ID for agent ${testAgent}: ${sessionId}`);
    
    // Step 3: Test agent status change
    console.log('\n3️⃣ Testing agent status change...');
    await setStatus(testAgent, 'READY');
    console.log('✅ Agent status set to READY');
    
    // Step 4: Test call initiation
    console.log('\n4️⃣ Testing call initiation...');
    const callResult = await callAgent(testAgent);
    console.log('✅ Call agent result:', callResult);
    
    // Step 5: Test recording status
    console.log('\n5️⃣ Testing recording status...');
    const recordingStatus = await getRecordingStatus(testAgent);
    console.log('✅ Recording status:', recordingStatus);
    
    // Step 6: Test call transfer
    console.log('\n6️⃣ Testing call transfer...');
    const transferResult = await transferCall(testAgent, '8600051');
    console.log('✅ Transfer result:', transferResult);
    
    // Step 7: Test call hangup
    console.log('\n7️⃣ Testing call hangup...');
    const hangupResult = await hangupCall(testAgent);
    console.log('✅ Hangup result:', hangupResult);
    
    // Step 8: Test agent status back to available
    console.log('\n8️⃣ Setting agent status back to available...');
    await setStatus(testAgent, 'AVAIL');
    console.log('✅ Agent status set to AVAIL');
    
    console.log('\n🎉 All call handling tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Call handling test failed:', error);
    console.error('Error stack:', error.stack);
  }
}

async function testMultipleAgents() {
  console.log('🧪 Starting Multiple Agents Test...\n');
  
  try {
    const availableAgents = getAvailableAgents();
    console.log('📋 Available agents:', availableAgents.slice(0, 5)); // Test first 5 agents
    
    // Test login for multiple agents
    const testAgents = ['8001', '8002', '8003'];
    const testBot = 'multi_test_bot';
    const testCampaign = '001';
    
    for (const agent of testAgents) {
      console.log(`\n🔄 Testing agent ${agent}...`);
      try {
        const assignment = await assignBotToAgent(testBot, testCampaign, agent);
        console.log(`✅ Agent ${agent} assigned successfully:`, assignment);
        
        // Test basic call operations
        const sessionId = getSessionId(agent);
        console.log(`✅ Session ID for agent ${agent}: ${sessionId}`);
        
        await setStatus(agent, 'READY');
        console.log(`✅ Agent ${agent} set to READY`);
        
      } catch (error) {
        console.error(`❌ Agent ${agent} test failed:`, error.message);
      }
    }
    
    console.log('\n🎉 Multiple agents test completed!');
    
  } catch (error) {
    console.error('❌ Multiple agents test failed:', error);
  }
}

async function testSessionRefresh() {
  console.log('🧪 Starting Session Refresh Test...\n');
  
  try {
    const testAgent = '8025';
    
    // Step 1: Initial login
    console.log('1️⃣ Initial login...');
    const assignment = await assignBotToAgent('refresh_test_bot', '001', testAgent);
    console.log('✅ Initial assignment:', assignment);
    
    const initialSessionId = getSessionId(testAgent);
    console.log('✅ Initial session ID:', initialSessionId);
    
    // Step 2: Refresh session
    console.log('\n2️⃣ Refreshing session...');
    const newSessionId = await refreshAgentSession(testAgent);
    console.log('✅ New session ID:', newSessionId);
    
    // Step 3: Verify new session works
    console.log('\n3️⃣ Testing new session...');
    await setStatus(testAgent, 'READY');
    console.log('✅ New session works correctly');
    
    console.log('\n🎉 Session refresh test completed!');
    
  } catch (error) {
    console.error('❌ Session refresh test failed:', error);
  }
}

// Export functions for use in other files
module.exports = {
  testCallHandling,
  testMultipleAgents,
  testSessionRefresh
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  
  if (testType === 'multiple') {
    testMultipleAgents();
  } else if (testType === 'refresh') {
    testSessionRefresh();
  } else {
    testCallHandling();
  }
}
