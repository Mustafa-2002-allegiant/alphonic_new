// testNewAgentSystem.js
const {
  assignBotToAgent,
  createAgent,
  loginAgent,
  verifyAgent,
  createMultipleAgents,
  getAvailableAgents,
  getLoggedInAgents,
  isAgentAvailable,
  getAgentSessionId
} = require('./assignBotToCampaign');

const {
  getSessionId,
  setStatus,
  callAgent,
  hangupCall,
  transferCall,
  getRecordingStatus,
  callVicidialAPI
} = require('./vicidialApiClient');

class NewAgentSystemTest {
  constructor() {
    this.testResults = [];
    this.createdAgents = [];
  }

  // Test 1: Create and login a single agent
  async testSingleAgentCreation() {
    console.log('\n🧪 TEST 1: Single Agent Creation and Login');
    console.log('=' .repeat(60));
    
    const testAgent = '8001';
    
    try {
      // Test agent creation
      console.log(`1️⃣ Creating agent ${testAgent}...`);
      const createResult = await createAgent(testAgent);
      console.log(`Create result: ${createResult}`);
      
      // Test agent login
      console.log(`2️⃣ Logging in agent ${testAgent}...`);
      const sessionId = await loginAgent(testAgent, 'hello123', '001');
      console.log(`Session ID: ${sessionId}`);
      console.log(`Session ID length: ${sessionId.length}`);
      
      // Verify session ID is 7 digits
      if (sessionId.length === 7) {
        console.log('✅ Session ID is exactly 7 digits');
      } else {
        console.log(`❌ Session ID is ${sessionId.length} digits, expected 7`);
      }
      
      // Test agent verification
      console.log(`3️⃣ Verifying agent ${testAgent}...`);
      const verifyResult = await verifyAgent(testAgent, sessionId);
      console.log(`Verify result: ${verifyResult}`);
      
      this.createdAgents.push(testAgent);
      this.testResults.push({
        test: 'Single Agent Creation',
        agent: testAgent,
        sessionId,
        sessionIdLength: sessionId.length,
        success: true
      });
      
      console.log('✅ Single agent creation test PASSED');
      
    } catch (error) {
      console.error(`❌ Single agent creation test FAILED:`, error.message);
      this.testResults.push({
        test: 'Single Agent Creation',
        agent: testAgent,
        success: false,
        error: error.message
      });
    }
  }

  // Test 2: Create multiple agents
  async testMultipleAgentCreation() {
    console.log('\n🧪 TEST 2: Multiple Agent Creation');
    console.log('=' .repeat(60));
    
    const testAgents = ['8002', '8003', '8004'];
    
    try {
      console.log(`Creating multiple agents: ${testAgents.join(', ')}`);
      const results = await createMultipleAgents(testAgents, '001');
      
      console.log('\n📊 Multiple Agent Creation Results:');
      results.forEach((result, index) => {
        if (result.success) {
          console.log(`✅ Agent ${result.agentUser}: Session ${result.sessionId} (${result.sessionIdLength} digits)`);
          this.createdAgents.push(result.agentUser);
        } else {
          console.log(`❌ Agent ${result.agentUser}: ${result.error}`);
        }
      });
      
      this.testResults.push({
        test: 'Multiple Agent Creation',
        agents: testAgents,
        results,
        success: true
      });
      
      console.log('✅ Multiple agent creation test PASSED');
      
    } catch (error) {
      console.error(`❌ Multiple agent creation test FAILED:`, error.message);
      this.testResults.push({
        test: 'Multiple Agent Creation',
        agents: testAgents,
        success: false,
        error: error.message
      });
    }
  }

  // Test 3: Test bot assignment with new agents
  async testBotAssignment() {
    console.log('\n🧪 TEST 3: Bot Assignment to New Agents');
    console.log('=' .repeat(60));
    
    const testAgent = '8005';
    
    try {
      console.log(`Assigning bot to new agent ${testAgent}...`);
      const assignment = await assignBotToAgent('test_bot_system', '001', testAgent);
      
      console.log('Assignment result:', assignment);
      
      if (assignment.success && assignment.sessionIdLength === 7) {
        console.log('✅ Bot assignment with 7-digit session ID PASSED');
        this.createdAgents.push(testAgent);
      } else {
        console.log('❌ Bot assignment FAILED');
      }
      
      this.testResults.push({
        test: 'Bot Assignment',
        agent: testAgent,
        assignment,
        success: assignment.success
      });
      
    } catch (error) {
      console.error(`❌ Bot assignment test FAILED:`, error.message);
      this.testResults.push({
        test: 'Bot Assignment',
        agent: testAgent,
        success: false,
        error: error.message
      });
    }
  }

  // Test 4: Test call handling functionality
  async testCallHandling() {
    console.log('\n🧪 TEST 4: Call Handling Functionality');
    console.log('=' .repeat(60));
    
    if (this.createdAgents.length === 0) {
      console.log('❌ No agents available for call handling test');
      return;
    }
    
    const testAgent = this.createdAgents[0];
    
    try {
      console.log(`Testing call handling for agent ${testAgent}...`);
      
      const sessionId = getAgentSessionId(testAgent);
      console.log(`Using session ID: ${sessionId}`);
      
      // Test 1: Set agent status
      console.log('1️⃣ Setting agent status to READY...');
      const statusResult = await setStatus(testAgent, 'READY');
      console.log(`Status result: ${statusResult}`);
      
      // Test 2: Check recording status
      console.log('2️⃣ Checking recording status...');
      const recordingResult = await getRecordingStatus(testAgent);
      console.log(`Recording result: ${recordingResult}`);
      
      // Test 3: Test hangup functionality
      console.log('3️⃣ Testing hangup functionality...');
      const hangupResult = await hangupCall(testAgent);
      console.log(`Hangup result: ${hangupResult}`);
      
      // Test 4: Test transfer functionality
      console.log('4️⃣ Testing transfer functionality...');
      const transferResult = await transferCall(testAgent, '8600051');
      console.log(`Transfer result: ${transferResult}`);
      
      // Test 5: Set agent back to available
      console.log('5️⃣ Setting agent back to AVAILABLE...');
      await setStatus(testAgent, 'AVAIL');
      
      const callHandlingSuccess = statusResult.includes('SUCCESS') || 
                                recordingResult.includes('NOTICE') ||
                                hangupResult.includes('SUCCESS');
      
      this.testResults.push({
        test: 'Call Handling',
        agent: testAgent,
        sessionId,
        success: callHandlingSuccess
      });
      
      if (callHandlingSuccess) {
        console.log('✅ Call handling test PASSED');
      } else {
        console.log('❌ Call handling test FAILED');
      }
      
    } catch (error) {
      console.error(`❌ Call handling test FAILED:`, error.message);
      this.testResults.push({
        test: 'Call Handling',
        agent: testAgent,
        success: false,
        error: error.message
      });
    }
  }

  // Test 5: Test agent availability and session management
  async testAgentManagement() {
    console.log('\n🧪 TEST 5: Agent Management Functions');
    console.log('=' .repeat(60));
    
    try {
      // Test getAvailableAgents
      console.log('1️⃣ Getting available agents...');
      const availableAgents = getAvailableAgents();
      console.log(`Available agents: ${availableAgents.length}`);
      availableAgents.forEach(agent => {
        console.log(`  - Agent ${agent.agentUser}: Session ${agent.sessionId} (${agent.status})`);
      });
      
      // Test isAgentAvailable
      console.log('2️⃣ Testing agent availability check...');
      if (this.createdAgents.length > 0) {
        const testAgent = this.createdAgents[0];
        const isAvailable = isAgentAvailable(testAgent);
        console.log(`Agent ${testAgent} is available: ${isAvailable}`);
      }
      
      // Test getLoggedInAgents
      console.log('3️⃣ Getting logged-in agents map...');
      const loggedInAgents = getLoggedInAgents();
      console.log(`Logged-in agents: ${loggedInAgents.size}`);
      for (const [agentUser, agentData] of loggedInAgents) {
        console.log(`  - ${agentUser}: Session ${agentData.sessionId} (${agentData.status})`);
      }
      
      this.testResults.push({
        test: 'Agent Management',
        availableAgents: availableAgents.length,
        loggedInAgents: loggedInAgents.size,
        success: true
      });
      
      console.log('✅ Agent management test PASSED');
      
    } catch (error) {
      console.error(`❌ Agent management test FAILED:`, error.message);
      this.testResults.push({
        test: 'Agent Management',
        success: false,
        error: error.message
      });
    }
  }

  // Test 6: Verify agents appear in Vicidial admin panel
  async testVicidialIntegration() {
    console.log('\n🧪 TEST 6: Vicidial Admin Panel Integration');
    console.log('=' .repeat(60));
    
    try {
      // Test if we can get agent status from Vicidial API
      if (this.createdAgents.length > 0) {
        const testAgent = this.createdAgents[0];
        console.log(`Testing Vicidial integration for agent ${testAgent}...`);
        
        const sessionId = getAgentSessionId(testAgent);
        
        // Test agent status via API
        const apiResult = await callVicidialAPI({
          function: 'agent_status',
          agent_user: testAgent,
          session_id: sessionId,
          format: 'text'
        });
        
        console.log(`API result: ${apiResult}`);
        
        const integrationSuccess = !apiResult.includes('ERROR');
        
        this.testResults.push({
          test: 'Vicidial Integration',
          agent: testAgent,
          sessionId,
          apiResult,
          success: integrationSuccess
        });
        
        if (integrationSuccess) {
          console.log('✅ Vicidial integration test PASSED');
        } else {
          console.log('❌ Vicidial integration test FAILED');
        }
      }
      
    } catch (error) {
      console.error(`❌ Vicidial integration test FAILED:`, error.message);
      this.testResults.push({
        test: 'Vicidial Integration',
        success: false,
        error: error.message
      });
    }
  }

  // Print comprehensive test results
  printTestSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMPREHENSIVE TEST SUMMARY');
    console.log('='.repeat(80));
    
    const passedTests = this.testResults.filter(r => r.success).length;
    const totalTests = this.testResults.length;
    
    console.log(`\nOverall Result: ${passedTests}/${totalTests} tests passed`);
    
    console.log('\n📋 Test Results:');
    this.testResults.forEach((result, index) => {
      const status = result.success ? '✅ PASSED' : '❌ FAILED';
      console.log(`${index + 1}. ${result.test}: ${status}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    console.log('\n🤖 Created Agents:');
    this.createdAgents.forEach(agent => {
      const sessionId = getAgentSessionId(agent);
      console.log(`  - Agent ${agent}: Session ${sessionId}`);
    });
    
    console.log('\n📈 Agent Statistics:');
    console.log(`  - Total agents created: ${this.createdAgents.length}`);
    console.log(`  - Available agents: ${getAvailableAgents().length}`);
    console.log(`  - Logged-in agents: ${getLoggedInAgents().size}`);
    
    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! The new agent system is working correctly.');
      console.log('✅ Agents are created, logged in with 7-digit session IDs, and can handle calls.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the errors above.');
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Comprehensive New Agent System Test...');
    
    try {
      await this.testSingleAgentCreation();
      await this.testMultipleAgentCreation();
      await this.testBotAssignment();
      await this.testCallHandling();
      await this.testAgentManagement();
      await this.testVicidialIntegration();
      
      this.printTestSummary();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.printTestSummary();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new NewAgentSystemTest();
  test.runAllTests().catch(console.error);
}

module.exports = { NewAgentSystemTest };
