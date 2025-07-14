// testTelephonyFix.js
const { assignBotToAgent } = require('./assignBotToCampaign');
const { 
  getSessionId, 
  setStatus, 
  callAgent, 
  hangupCall, 
  transferCall, 
  getRecordingStatus,
  callVicidialAPI 
} = require('./vicidialApiClient');

async function testTelephonyFix() {
  console.log('🔧 Testing Telephony System Integration Fix...\n');
  
  const testAgents = ['8024', '8025', '8015'];
  const testResults = [];
  
  for (const agent of testAgents) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 Testing Agent: ${agent}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      // Step 1: Assign bot to agent (this will now use API login)
      console.log('1️⃣ Assigning bot to agent...');
      const assignment = await assignBotToAgent('telephony_test_bot', '001', agent);
      console.log('✅ Assignment successful:', assignment);
      
      // Step 2: Get session ID
      console.log('2️⃣ Getting session ID...');
      const sessionId = getSessionId(agent);
      console.log('✅ Session ID:', sessionId);
      
      // Step 3: Test agent status change
      console.log('3️⃣ Testing status change to READY...');
      const statusResult = await setStatus(agent, 'READY');
      console.log('Status result:', statusResult);
      
      if (statusResult.includes('SUCCESS')) {
        console.log('✅ Status change successful!');
      } else if (statusResult.includes('ERROR')) {
        console.log('❌ Status change failed:', statusResult);
      }
      
      // Step 4: Test recording status
      console.log('4️⃣ Testing recording status...');
      const recordingResult = await getRecordingStatus(agent);
      console.log('Recording result:', recordingResult);
      
      if (recordingResult.includes('NOTICE') && !recordingResult.includes('ERROR')) {
        console.log('✅ Recording status check successful!');
      } else {
        console.log('❌ Recording status check failed:', recordingResult);
      }
      
      // Step 5: Test call operations
      console.log('5️⃣ Testing call operations...');
      const callResult = await callAgent(agent);
      console.log('Call result:', callResult);
      
      // Step 6: Test hangup
      console.log('6️⃣ Testing hangup...');
      const hangupResult = await hangupCall(agent);
      console.log('Hangup result:', hangupResult);
      
      // Step 7: Test transfer
      console.log('7️⃣ Testing transfer...');
      const transferResult = await transferCall(agent, '8600051');
      console.log('Transfer result:', transferResult);
      
      // Step 8: Set back to available
      console.log('8️⃣ Setting back to AVAILABLE...');
      await setStatus(agent, 'AVAIL');
      
      // Determine overall success
      const isSuccessful = !statusResult.includes('ERROR') && 
                          !recordingResult.includes('ERROR');
      
      testResults.push({
        agent,
        sessionId,
        success: isSuccessful,
        statusResult,
        recordingResult
      });
      
      console.log(`\n${isSuccessful ? '✅' : '❌'} Agent ${agent} test ${isSuccessful ? 'PASSED' : 'FAILED'}`);
      
    } catch (error) {
      console.error(`❌ Agent ${agent} test failed:`, error.message);
      testResults.push({
        agent,
        success: false,
        error: error.message
      });
    }
    
    // Wait between tests to avoid conflicts
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(70));
  
  const successCount = testResults.filter(r => r.success).length;
  const totalCount = testResults.length;
  
  console.log(`\nOverall Result: ${successCount}/${totalCount} agents passed`);
  
  testResults.forEach(result => {
    if (result.success) {
      console.log(`✅ Agent ${result.agent}: Session ${result.sessionId} - WORKING`);
    } else {
      console.log(`❌ Agent ${result.agent}: FAILED - ${result.error || 'API errors'}`);
    }
  });
  
  if (successCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED! Telephony integration is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
  
  return testResults;
}

// Quick single agent test
async function testSingleAgentFix(agentUser) {
  console.log(`🧪 Quick test for agent ${agentUser}...\n`);
  
  try {
    // Step 1: Assign bot
    console.log('1️⃣ Assigning bot...');
    const assignment = await assignBotToAgent('quick_test_bot', '001', agentUser);
    console.log('✅ Assignment:', assignment);
    
    // Step 2: Test basic API call
    console.log('2️⃣ Testing API call...');
    const statusResult = await setStatus(agentUser, 'READY');
    console.log('Status result:', statusResult);
    
    if (statusResult.includes('SUCCESS')) {
      console.log('🎉 SUCCESS! Agent is properly logged into telephony system.');
    } else if (statusResult.includes('ERROR')) {
      console.log('❌ FAILED! Agent not properly logged in:', statusResult);
    }
    
    // Step 3: Test recording status
    console.log('3️⃣ Testing recording status...');
    const recordingResult = await getRecordingStatus(agentUser);
    console.log('Recording result:', recordingResult);
    
    if (recordingResult.includes('NOTICE') && !recordingResult.includes('ERROR')) {
      console.log('✅ Recording status check successful!');
    }
    
    return !statusResult.includes('ERROR') && !recordingResult.includes('ERROR');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Export functions
module.exports = {
  testTelephonyFix,
  testSingleAgentFix
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  const agentUser = process.argv[3];
  
  if (testType === 'single' && agentUser) {
    testSingleAgentFix(agentUser);
  } else {
    testTelephonyFix();
  }
}
