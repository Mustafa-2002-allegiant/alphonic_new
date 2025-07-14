// testVicidialWebAutomation.js
const VicidialWebAutomation = require('./vicidialWebAutomation');
require('dotenv').config();

async function testVicidialWebAutomation() {
  const automation = new VicidialWebAutomation();
  
  try {
    console.log('🚀 Starting ViciDial Web Automation Test...\n');
    
    // Step 1: Initialize browser
    console.log('1️⃣ Initializing browser...');
    await automation.initialize();
    console.log('✅ Browser initialized successfully\n');
    
    // Step 2: Login agent using credentials from .env
    console.log('2️⃣ Logging in agent...');
    const username = process.env.VICIDIAL_AGENT_USER;
    const password = process.env.VICIDIAL_AGENT_PASS;
    
    console.log(`🔐 Using credentials - Username: ${username}, Password: ${password}`);
    const sessionId = await automation.loginAgent(username, password);
    console.log(`✅ Login successful! Session ID: ${sessionId}\n`);
    
    // Step 3: Set agent status to available
    console.log('3️⃣ Setting agent status to READY...');
    await automation.setAgentStatus('READY');
    console.log('✅ Agent status set to READY\n');
    
    // Step 4: Get current call status
    console.log('4️⃣ Getting current call status...');
    const callStatus = await automation.getCallStatus();
    console.log(`📞 Current call status: ${callStatus}\n`);
    
    // Step 5: Make a test call (you can change this number)
    console.log('5️⃣ Making a test call...');
    const testPhoneNumber = '1234567890'; // Change this to a valid test number
    console.log(`📞 Calling: ${testPhoneNumber}`);
    await automation.makeCall(testPhoneNumber);
    console.log('✅ Call initiated\n');
    
    // Wait a bit to see the call in action
    console.log('⏳ Waiting 5 seconds to observe call...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 6: Get call status after making call
    console.log('6️⃣ Getting call status after dialing...');
    const newCallStatus = await automation.getCallStatus();
    console.log(`📞 Call status after dialing: ${newCallStatus}\n`);
    
    // Step 7: Hangup the call
    console.log('7️⃣ Hanging up the call...');
    await automation.hangupCall();
    console.log('✅ Call hung up\n');
    
    // Optional: Test transfer functionality (uncomment if needed)
    /*
    console.log('8️⃣ Testing call transfer...');
    await automation.makeCall(testPhoneNumber);
    await new Promise(resolve => setTimeout(resolve, 3000));
    await automation.transferCall('9876543210'); // Transfer to this number
    console.log('✅ Call transfer initiated\n');
    */
    
    console.log('🎉 All tests completed successfully!');
    
    // Keep browser open for manual inspection (remove this in production)
    console.log('\n🔍 Browser will stay open for 30 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Step 8: Cleanup
    console.log('\n🧹 Cleaning up...');
    await automation.close();
    console.log('✅ Browser closed');
  }
}

// Alternative function to test individual features
async function testIndividualFeatures() {
  const automation = new VicidialWebAutomation();
  
  try {
    await automation.initialize();
    
    // Test only login
    console.log('Testing login only...');
    await automation.loginAgent(
      process.env.VICIDIAL_AGENT_USER, 
      process.env.VICIDIAL_AGENT_PASS
    );
    
    // Test only status change
    console.log('Testing status change...');
    await automation.setAgentStatus('READY');
    
    // Keep browser open for manual testing
    console.log('Browser is ready for manual testing. Press Ctrl+C to exit.');
    await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
    
  } catch (error) {
    console.error('Individual test failed:', error);
  } finally {
    await automation.close();
  }
}

// Export functions for use in other files
module.exports = {
  testVicidialWebAutomation,
  testIndividualFeatures,
  VicidialWebAutomation
};

// Run test if this file is executed directly
if (require.main === module) {
  const testType = process.argv[2];
  
  if (testType === 'individual') {
    testIndividualFeatures();
  } else {
    testVicidialWebAutomation();
  }
}
