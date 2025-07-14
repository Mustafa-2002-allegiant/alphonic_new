// testApiEndpoints.js
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:8080';

async function testGetAvailableAgents() {
  console.log('🧪 Testing GET /available-agents...');
  
  try {
    const response = await fetch(`${BASE_URL}/available-agents`);
    const data = await response.json();
    console.log('✅ Available agents response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error getting available agents:', error);
    return null;
  }
}

async function testEnhancedBotAssignment() {
  console.log('🧪 Testing POST /assign-bot-with-auto-login...');
  
  try {
    const response = await fetch(`${BASE_URL}/assign-bot-with-auto-login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        botId: 'test_api_bot',
        campaignId: '001',
        agentUser: '8026'
      })
    });
    
    const data = await response.json();
    console.log('✅ Enhanced bot assignment response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in enhanced bot assignment:', error);
    return null;
  }
}

async function testSessionRefresh() {
  console.log('🧪 Testing POST /refresh-agent-session...');
  
  try {
    const response = await fetch(`${BASE_URL}/refresh-agent-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agentUser: '8026'
      })
    });
    
    const data = await response.json();
    console.log('✅ Session refresh response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in session refresh:', error);
    return null;
  }
}

async function testStartBotSession() {
  console.log('🧪 Testing POST /start-bot-session...');
  
  try {
    const response = await fetch(`${BASE_URL}/start-bot-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_user: '8026',
        botId: 'test_api_bot'
      })
    });
    
    const data = await response.json();
    console.log('✅ Start bot session response:', data);
    return data;
  } catch (error) {
    console.error('❌ Error in start bot session:', error);
    return null;
  }
}

async function runAllTests() {
  console.log('🚀 Starting API endpoint tests...\n');
  
  // Test 1: Get available agents
  const agents = await testGetAvailableAgents();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 2: Enhanced bot assignment
  const assignment = await testEnhancedBotAssignment();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 3: Session refresh
  const refresh = await testSessionRefresh();
  console.log('\n' + '='.repeat(50) + '\n');
  
  // Test 4: Start bot session
  const session = await testStartBotSession();
  console.log('\n' + '='.repeat(50) + '\n');
  
  console.log('🎉 All API endpoint tests completed!');
  
  return {
    agents,
    assignment,
    refresh,
    session
  };
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testGetAvailableAgents,
  testEnhancedBotAssignment,
  testSessionRefresh,
  testStartBotSession,
  runAllTests
};
