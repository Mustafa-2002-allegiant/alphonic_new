// testExistingAgents.js
const { callVicidialAPI, setWebSessionId } = require('./vicidialApiClient');

async function testExistingAgents() {
  console.log('🔍 Testing with existing agents from dashboard...\n');
  
  // These are the agents shown in the dashboard with their session IDs
  const existingAgents = [
    { agent: '8025', sessionId: '89' },
    { agent: '8015', sessionId: '90' },
    { agent: '8007', sessionId: '88' },
    { agent: '8024', sessionId: '92' }
  ];
  
  for (const { agent, sessionId } of existingAgents) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🧪 Testing Agent: ${agent} with Session ID: ${sessionId}`);
    console.log(`${'='.repeat(50)}`);
    
    try {
      // Set the session ID manually
      setWebSessionId(agent, sessionId);
      console.log(`✅ Set session ID ${sessionId} for agent ${agent}`);
      
      // Test 1: Check recording status
      console.log('1️⃣ Testing recording status...');
      const recordingResult = await callVicidialAPI({
        function: 'recording',
        agent_user: agent,
        session_user: agent,
        session_id: sessionId,
        value: 'STATUS'
      });
      console.log('Recording result:', recordingResult);
      
      // Test 2: Set agent status
      console.log('2️⃣ Testing status change...');
      const statusResult = await callVicidialAPI({
        function: 'external_status',
        agent_user: agent,
        session_user: agent,
        session_id: sessionId,
        value: 'READY'
      });
      console.log('Status result:', statusResult);
      
      // Test 3: Test hangup
      console.log('3️⃣ Testing hangup...');
      const hangupResult = await callVicidialAPI({
        function: 'external_hangup',
        agent_user: agent,
        session_user: agent,
        session_id: sessionId,
        value: '1'
      });
      console.log('Hangup result:', hangupResult);
      
      // Test 4: Test transfer
      console.log('4️⃣ Testing transfer...');
      const transferResult = await callVicidialAPI({
        function: 'transfer_conference',
        agent_user: agent,
        session_user: agent,
        session_id: sessionId,
        value: 'DIAL_WITH_CUSTOMER',
        phone_number: '8600051'
      });
      console.log('Transfer result:', transferResult);
      
      // Determine success
      const isWorking = !recordingResult.includes('ERROR') || 
                       !statusResult.includes('ERROR');
      
      console.log(`\n${isWorking ? '✅' : '❌'} Agent ${agent} is ${isWorking ? 'WORKING' : 'NOT WORKING'}`);
      
    } catch (error) {
      console.error(`❌ Error testing agent ${agent}:`, error.message);
    }
  }
  
  console.log('\n🎯 CONCLUSION: If any of these agents work, we can use their session IDs directly!');
}

async function createWorkingAgentFunction() {
  console.log('🛠️ Creating working agent assignment function...\n');
  
  // Map of working agents with their session IDs
  const workingAgents = {
    '8025': '89',
    '8015': '90', 
    '8007': '88',
    '8024': '92'
  };
  
  console.log('Available working agents:', Object.keys(workingAgents));
  
  // Test assigning bot to one of these agents
  const testAgent = '8024';
  const testSessionId = workingAgents[testAgent];
  
  console.log(`\n🧪 Testing bot assignment to agent ${testAgent}...`);
  
  try {
    // Set the session ID
    setWebSessionId(testAgent, testSessionId);
    
    // Test if it works
    const recordingResult = await callVicidialAPI({
      function: 'recording',
      agent_user: testAgent,
      session_user: testAgent,
      session_id: testSessionId,
      value: 'STATUS'
    });
    
    console.log('Recording test result:', recordingResult);
    
    if (!recordingResult.includes('ERROR')) {
      console.log('🎉 SUCCESS! We can use this approach for bot assignment!');
      
      // Store in Firestore
      const db = require('./firebaseConfig');
      await db.collection('bot_assignments').add({
        botId: 'working_test_bot',
        campaignId: '001',
        agentUser: testAgent,
        sessionId: testSessionId,
        isActive: true,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      });
      
      console.log('✅ Bot assignment stored in database');
      
      return {
        success: true,
        agentUser: testAgent,
        sessionId: testSessionId,
        botId: 'working_test_bot',
        campaignId: '001'
      };
    } else {
      console.log('❌ Agent not working properly');
      return null;
    }
    
  } catch (error) {
    console.error('❌ Error in working agent test:', error.message);
    return null;
  }
}

// Export functions
module.exports = {
  testExistingAgents,
  createWorkingAgentFunction
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  
  if (testType === 'create') {
    createWorkingAgentFunction();
  } else {
    testExistingAgents();
  }
}
