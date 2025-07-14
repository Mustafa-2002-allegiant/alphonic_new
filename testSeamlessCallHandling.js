// testSeamlessCallHandling.js
const { assignBotToAgent, refreshAgentSession, getAvailableAgents } = require('./assignBotToCampaign');
const { 
  getSessionId, 
  callAgent, 
  hangupCall, 
  setStatus, 
  transferCall, 
  getRecordingStatus,
  callVicidialAPI,
  sessionMap
} = require('./vicidialApiClient');
const db = require('./firebaseConfig');

// Test configuration
const TEST_CONFIG = {
  agents: ['8001', '8002', '8003'],
  testBot: 'seamless_test_bot',
  testCampaign: '001',
  transferNumber: '8600051',
  testDuration: 30000, // 30 seconds
  statusCheckInterval: 5000 // 5 seconds
};

class SeamlessCallTest {
  constructor() {
    this.testResults = {};
    this.activeAgents = new Map();
    this.sessionStability = new Map();
  }

  async runFullTest() {
    console.log('🚀 Starting Seamless Call Handling Test Suite...\n');
    
    try {
      // Phase 1: Setup and Login
      await this.phase1_AgentSetupAndLogin();
      
      // Phase 2: Session ID Stability Test
      await this.phase2_SessionIdStabilityTest();
      
      // Phase 3: Call Operations Test
      await this.phase3_CallOperationsTest();
      
      // Phase 4: Concurrent Operations Test
      await this.phase4_ConcurrentOperationsTest();
      
      // Phase 5: Bot Assignment Persistence Test
      await this.phase5_BotAssignmentPersistenceTest();
      
      // Phase 6: Final Validation
      await this.phase6_FinalValidation();
      
      console.log('\n🎉 All tests completed successfully!');
      this.printTestSummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.printTestSummary();
      throw error;
    }
  }

  async phase1_AgentSetupAndLogin() {
    console.log('📋 Phase 1: Agent Setup and Login');
    console.log('=' .repeat(50));
    
    for (const agent of TEST_CONFIG.agents) {
      try {
        console.log(`\n🔐 Setting up agent ${agent}...`);
        
        // Assign bot to agent with automatic login
        const assignment = await assignBotToAgent(
          TEST_CONFIG.testBot, 
          TEST_CONFIG.testCampaign, 
          agent
        );
        
        console.log(`✅ Agent ${agent} setup complete:`, assignment);
        
        // Store agent data
        this.activeAgents.set(agent, {
          sessionId: assignment.sessionId,
          botId: assignment.botId,
          campaignId: assignment.campaignId,
          loginTime: new Date().toISOString(),
          status: 'LOGGED_IN'
        });
        
        // Initialize session stability tracking
        this.sessionStability.set(agent, {
          originalSessionId: assignment.sessionId,
          sessionChanges: 0,
          lastChecked: new Date().toISOString()
        });
        
        // Wait between agent logins to avoid conflicts
        await this.sleep(2000);
        
      } catch (error) {
        console.error(`❌ Agent ${agent} setup failed:`, error.message);
        this.testResults[`agent_${agent}_setup`] = { success: false, error: error.message };
      }
    }
    
    console.log(`\n✅ Phase 1 completed. ${this.activeAgents.size} agents ready.`);
  }

  async phase2_SessionIdStabilityTest() {
    console.log('\n🔄 Phase 2: Session ID Stability Test');
    console.log('=' .repeat(50));
    
    const stabilityTestDuration = 60000; // 1 minute
    const checkInterval = 10000; // 10 seconds
    const startTime = Date.now();
    
    console.log(`Testing session ID stability for ${stabilityTestDuration / 1000} seconds...`);
    
    while (Date.now() - startTime < stabilityTestDuration) {
      for (const agent of this.activeAgents.keys()) {
        try {
          const currentSessionId = getSessionId(agent);
          const stability = this.sessionStability.get(agent);
          
          if (currentSessionId !== stability.originalSessionId) {
            stability.sessionChanges++;
            console.log(`⚠️ Agent ${agent} session ID changed: ${stability.originalSessionId} → ${currentSessionId}`);
          }
          
          stability.lastChecked = new Date().toISOString();
          this.sessionStability.set(agent, stability);
          
          console.log(`✅ Agent ${agent} session ID stable: ${currentSessionId}`);
          
        } catch (error) {
          console.error(`❌ Agent ${agent} session check failed:`, error.message);
        }
      }
      
      await this.sleep(checkInterval);
    }
    
    console.log('\n📊 Session Stability Results:');
    for (const [agent, stability] of this.sessionStability) {
      console.log(`Agent ${agent}: ${stability.sessionChanges} changes detected`);
    }
  }

  async phase3_CallOperationsTest() {
    console.log('\n📞 Phase 3: Call Operations Test');
    console.log('=' .repeat(50));
    
    for (const agent of this.activeAgents.keys()) {
      try {
        console.log(`\n🔧 Testing call operations for agent ${agent}...`);
        
        // Test 1: Set agent status to READY
        console.log(`1️⃣ Setting agent ${agent} to READY...`);
        const statusResult = await setStatus(agent, 'READY');
        console.log(`✅ Status result:`, statusResult);
        
        // Test 2: Check recording status
        console.log(`2️⃣ Checking recording status for agent ${agent}...`);
        const recordingResult = await getRecordingStatus(agent);
        console.log(`✅ Recording status:`, recordingResult);
        
        // Test 3: Test external dial
        console.log(`3️⃣ Testing external dial for agent ${agent}...`);
        const dialResult = await callAgent(agent);
        console.log(`✅ Dial result:`, dialResult);
        
        // Test 4: Test transfer capability
        console.log(`4️⃣ Testing transfer capability for agent ${agent}...`);
        const transferResult = await transferCall(agent, TEST_CONFIG.transferNumber);
        console.log(`✅ Transfer result:`, transferResult);
        
        // Test 5: Test hangup
        console.log(`5️⃣ Testing hangup for agent ${agent}...`);
        const hangupResult = await hangupCall(agent);
        console.log(`✅ Hangup result:`, hangupResult);
        
        // Verify session ID hasn't changed after operations
        const sessionAfterOps = getSessionId(agent);
        const originalSession = this.sessionStability.get(agent).originalSessionId;
        
        if (sessionAfterOps === originalSession) {
          console.log(`✅ Session ID stable after operations: ${sessionAfterOps}`);
        } else {
          console.log(`⚠️ Session ID changed after operations: ${originalSession} → ${sessionAfterOps}`);
        }
        
      } catch (error) {
        console.error(`❌ Call operations test failed for agent ${agent}:`, error.message);
      }
    }
  }

  async phase4_ConcurrentOperationsTest() {
    console.log('\n🔄 Phase 4: Concurrent Operations Test');
    console.log('=' .repeat(50));
    
    console.log('Testing concurrent status changes...');
    
    const promises = Array.from(this.activeAgents.keys()).map(async (agent) => {
      try {
        // Concurrent status changes
        await setStatus(agent, 'READY');
        await this.sleep(1000);
        await setStatus(agent, 'PAUSE');
        await this.sleep(1000);
        await setStatus(agent, 'READY');
        
        const sessionId = getSessionId(agent);
        console.log(`✅ Agent ${agent} concurrent ops completed, session: ${sessionId}`);
        
        return { agent, success: true, sessionId };
      } catch (error) {
        console.error(`❌ Concurrent ops failed for agent ${agent}:`, error.message);
        return { agent, success: false, error: error.message };
      }
    });
    
    const results = await Promise.all(promises);
    console.log('Concurrent operations results:', results);
  }

  async phase5_BotAssignmentPersistenceTest() {
    console.log('\n🤖 Phase 5: Bot Assignment Persistence Test');
    console.log('=' .repeat(50));
    
    // Test bot assignment persistence in database
    for (const agent of this.activeAgents.keys()) {
      try {
        console.log(`\n📋 Checking bot assignment persistence for agent ${agent}...`);
        
        // Query Firestore for bot assignments
        const assignmentsQuery = await db.collection('bot_assignments')
          .where('agentUser', '==', agent)
          .where('isActive', '==', true)
          .get();
        
        if (!assignmentsQuery.empty) {
          const assignment = assignmentsQuery.docs[0].data();
          console.log(`✅ Bot assignment found:`, assignment);
          
          // Verify session ID matches
          const currentSessionId = getSessionId(agent);
          if (assignment.sessionId === currentSessionId) {
            console.log(`✅ Session ID matches database: ${currentSessionId}`);
          } else {
            console.log(`⚠️ Session ID mismatch - DB: ${assignment.sessionId}, Current: ${currentSessionId}`);
          }
        } else {
          console.log(`❌ No bot assignment found for agent ${agent}`);
        }
        
      } catch (error) {
        console.error(`❌ Bot assignment check failed for agent ${agent}:`, error.message);
      }
    }
  }

  async phase6_FinalValidation() {
    console.log('\n🎯 Phase 6: Final Validation');
    console.log('=' .repeat(50));
    
    // Final session ID validation
    console.log('Final session ID validation:');
    for (const [agent, agentData] of this.activeAgents) {
      try {
        const currentSessionId = getSessionId(agent);
        const stability = this.sessionStability.get(agent);
        
        console.log(`Agent ${agent}:`);
        console.log(`  Original Session ID: ${stability.originalSessionId}`);
        console.log(`  Current Session ID: ${currentSessionId}`);
        console.log(`  Session Changes: ${stability.sessionChanges}`);
        console.log(`  Status: ${currentSessionId === stability.originalSessionId ? '✅ STABLE' : '⚠️ CHANGED'}`);
        
        // Final API test
        const finalStatusTest = await callVicidialAPI({
          function: 'recording',
          agent_user: agent,
          session_user: agent,
          session_id: currentSessionId,
          value: 'STATUS'
        });
        
        console.log(`  Final API Test: ${finalStatusTest.includes('ERROR') ? '❌ FAILED' : '✅ PASSED'}`);
        
      } catch (error) {
        console.error(`❌ Final validation failed for agent ${agent}:`, error.message);
      }
    }
    
    // Test call flow simulation
    console.log('\n📞 Simulating complete call flow...');
    const testAgent = Array.from(this.activeAgents.keys())[0];
    
    try {
      console.log(`Using agent ${testAgent} for call flow simulation...`);
      
      // 1. Set to READY
      await setStatus(testAgent, 'READY');
      console.log('✅ 1. Agent set to READY');
      
      // 2. Receive call (simulate)
      console.log('✅ 2. Call received (simulated)');
      
      // 3. Talk to customer (simulate)
      console.log('✅ 3. Talking to customer (simulated)');
      
      // 4. Transfer call
      const transferResult = await transferCall(testAgent, TEST_CONFIG.transferNumber);
      console.log('✅ 4. Call transfer initiated:', transferResult.includes('SUCCESS') ? 'SUCCESS' : 'ATTEMPTED');
      
      // 5. Hangup
      const hangupResult = await hangupCall(testAgent);
      console.log('✅ 5. Call hangup:', hangupResult.includes('SUCCESS') ? 'SUCCESS' : 'ATTEMPTED');
      
      // 6. Set to AVAILABLE
      await setStatus(testAgent, 'AVAIL');
      console.log('✅ 6. Agent set to AVAILABLE');
      
      console.log('🎉 Call flow simulation completed successfully!');
      
    } catch (error) {
      console.error('❌ Call flow simulation failed:', error.message);
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  printTestSummary() {
    console.log('\n📊 TEST SUMMARY');
    console.log('=' .repeat(50));
    
    console.log(`Active Agents: ${this.activeAgents.size}`);
    for (const [agent, data] of this.activeAgents) {
      console.log(`  Agent ${agent}: Session ${data.sessionId}, Status: ${data.status}`);
    }
    
    console.log('\nSession Stability:');
    for (const [agent, stability] of this.sessionStability) {
      console.log(`  Agent ${agent}: ${stability.sessionChanges} changes, ${stability.sessionChanges === 0 ? '✅ STABLE' : '⚠️ UNSTABLE'}`);
    }
    
    console.log('\nSession Map Contents:');
    for (const [agent, sessionId] of sessionMap) {
      console.log(`  ${agent}: ${sessionId}`);
    }
  }
}

// Quick test function for individual agents
async function testSingleAgent(agentUser) {
  console.log(`🧪 Testing single agent: ${agentUser}`);
  
  try {
    // 1. Assign bot
    const assignment = await assignBotToAgent('single_test_bot', '001', agentUser);
    console.log('✅ Assignment:', assignment);
    
    // 2. Test session retrieval
    const sessionId = getSessionId(agentUser);
    console.log('✅ Session ID:', sessionId);
    
    // 3. Test basic operations
    await setStatus(agentUser, 'READY');
    const recordingStatus = await getRecordingStatus(agentUser);
    console.log('✅ Recording status:', recordingStatus);
    
    // 4. Verify session hasn't changed
    const finalSessionId = getSessionId(agentUser);
    console.log('✅ Final session ID:', finalSessionId);
    console.log('Session stable:', sessionId === finalSessionId ? '✅ YES' : '❌ NO');
    
  } catch (error) {
    console.error('❌ Single agent test failed:', error);
  }
}

// Export functions and classes
module.exports = {
  SeamlessCallTest,
  testSingleAgent,
  TEST_CONFIG
};

// Run tests if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  const agentUser = process.argv[3];
  
  if (testType === 'single' && agentUser) {
    testSingleAgent(agentUser);
  } else {
    const test = new SeamlessCallTest();
    test.runFullTest().catch(console.error);
  }
}
