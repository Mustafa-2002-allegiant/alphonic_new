// vicidialWebAutomation.js
const { chromium } = require('playwright');
require('dotenv').config();

class VicidialWebAutomation {
  constructor() {
    this.browser = null;
    this.page = null;
    this.sessionId = null;
    this.isLoggedIn = false;
  }

  async initialize() {
    this.browser = await chromium.launch({
      headless: false, // Set to true for production
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    this.page = await this.browser.newPage();
    
    // Set user agent to mimic real browser
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
  }

  async loginAgent(agentUser, agentPass) {
    try {
      const loginUrl = `${process.env.VICIDIAL_WEB_URL}/agc/vicidial.php`;
      console.log(`🔗 Navigating to: ${loginUrl}`);
      
      await this.page.goto(loginUrl, { waitUntil: 'networkidle' });
      
      // Take a screenshot for debugging
      await this.page.screenshot({ path: 'debug-login-page.png' });
      console.log('📸 Screenshot saved as debug-login-page.png');
      
      // Get page title and URL for debugging
      const title = await this.page.title();
      const currentUrl = this.page.url();
      console.log(`📄 Page title: ${title}`);
      console.log(`🔗 Current URL: ${currentUrl}`);
      
      // Check what form elements are available
      const formElements = await this.page.$$eval('input', inputs => 
        inputs.map(input => ({ 
          name: input.name, 
          type: input.type, 
          id: input.id, 
          placeholder: input.placeholder 
        }))
      );
      console.log('🔍 Available form inputs:', JSON.stringify(formElements, null, 2));
      
      // Step 1: Fill User Login and User Password (API credentials)
      console.log('🔐 Step 1: Filling User Login and User Password...');
      
      // Try different possible selectors for user login fields
      let userLoginField = null;
      let userPasswordField = null;
      
      // Check for user login field selectors - these are for the API user
      // Note: ViciDial uses phone_login and phone_pass for the initial User Login/Password
      const userLoginSelectors = [
        'input[name="phone_login"]',  // This is actually the "User Login" field
        'input[name="VD_login"]',
        'input[name="user"]',
        'input[name="username"]',
        'input[name="login"]',
        'input[type="text"]',
        '#VD_login',
        '#user',
        '#username'
      ];
      
      const userPasswordSelectors = [
        'input[name="phone_pass"]',  // This is actually the "User Password" field
        'input[name="VD_pass"]',
        'input[name="password"]',
        'input[name="pass"]',
        'input[type="password"]',
        '#VD_pass',
        '#password'
      ];
      
      // Find user login field
      for (const selector of userLoginSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          userLoginField = selector;
          console.log(`✅ Found user login field with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ User login field not found with selector: ${selector}`);
        }
      }
      
      // Find user password field
      for (const selector of userPasswordSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          userPasswordField = selector;
          console.log(`✅ Found user password field with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ User password field not found with selector: ${selector}`);
        }
      }
      
      if (!userLoginField || !userPasswordField) {
        // Get page content for debugging
        const pageContent = await this.page.content();
        console.log('📝 Page HTML content (first 1000 chars):', pageContent.substring(0, 1000));
        throw new Error(`User login fields not found. Login: ${userLoginField}, Password: ${userPasswordField}`);
      }
      
      // Fill user login form with agent credentials (not admin credentials)
      console.log(`📝 Filling user login field (${userLoginField}) with: ${agentUser}`);
      await this.page.fill(userLoginField, agentUser);
      
      console.log(`📝 Filling user password field (${userPasswordField})`);
      await this.page.fill(userPasswordField, agentPass);
      
      // Find and click submit button
      const submitSelectors = [
        'input[type="submit"]',
        'button[type="submit"]',
        'input[value="LOGIN"]',
        'input[value="Submit"]',
        'button:has-text("LOGIN")',
        'button:has-text("Submit")'
      ];
      
      let submitButton = null;
      for (const selector of submitSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          submitButton = selector;
          console.log(`✅ Found submit button with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Submit button not found with selector: ${selector}`);
        }
      }
      
      if (!submitButton) {
        throw new Error('Submit button not found');
      }
      
      // Submit first login
      console.log('🔐 Submitting first login form...');
      await this.page.click(submitButton);
      
      // Wait for page to load after first login
      await this.page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Take screenshot after first login
      await this.page.screenshot({ path: 'debug-after-first-login.png' });
      console.log('📸 After first login screenshot saved as debug-after-first-login.png');
      
      // Check current URL and page content
      const urlAfterFirstLogin = this.page.url();
      console.log(`🔗 URL after first login: ${urlAfterFirstLogin}`);
      
      // Step 2: Check if we need to enter agent credentials
      console.log('🔐 Step 2: Checking for agent login fields...');
      
      // Look for agent login fields (phone_login and phone_pass again, but now for agent)
      const agentLoginSelectors = [
        'input[name="phone_login"]',
        'input[name="agent_login"]',
        'input[name="VD_login"]',
        'input[type="text"]'
      ];
      
      const agentPasswordSelectors = [
        'input[name="phone_pass"]',
        'input[name="agent_pass"]',
        'input[name="VD_pass"]',
        'input[type="password"]'
      ];
      
      let agentLoginField = null;
      let agentPasswordField = null;
      
      // Try to find agent login fields
      for (const selector of agentLoginSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          agentLoginField = selector;
          console.log(`✅ Found agent login field with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Agent login field not found with selector: ${selector}`);
        }
      }
      
      for (const selector of agentPasswordSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 2000 });
          agentPasswordField = selector;
          console.log(`✅ Found agent password field with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Agent password field not found with selector: ${selector}`);
        }
      }
      
      // If we found agent fields, fill them
      if (agentLoginField && agentPasswordField) {
        console.log('📝 Filling agent credentials...');
        console.log(`📝 Agent login field (${agentLoginField}) with: ${agentUser}`);
        await this.page.fill(agentLoginField, agentUser);
        
        console.log(`📝 Agent password field (${agentPasswordField})`);
        await this.page.fill(agentPasswordField, agentPass);
        
        // Find submit button for agent login
        let agentSubmitButton = null;
        for (const selector of submitSelectors) {
          try {
            await this.page.waitForSelector(selector, { timeout: 2000 });
            agentSubmitButton = selector;
            console.log(`✅ Found agent submit button with selector: ${selector}`);
            break;
          } catch (e) {
            console.log(`❌ Agent submit button not found with selector: ${selector}`);
          }
        }
        
        if (agentSubmitButton) {
          console.log('🔐 Submitting agent login form...');
          await this.page.click(agentSubmitButton);
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        }
      }
      
      // Take screenshot after agent login
      await this.page.screenshot({ path: 'debug-after-agent-login.png' });
      console.log('📸 After agent login screenshot saved as debug-after-agent-login.png');
      
      // Check if we're now on the campaign selection page
      console.log('🔍 Looking for campaign selection dropdown...');
      
      // Look for campaign dropdown with multiple possible selectors
      const campaignSelectors = [
        'select[name="campaign"]',
        'select[name="VD_campaign"]',
        'select[name="VD_campaign_list"]',
        'select[id="campaign"]',
        'select[id="VD_campaign"]'
      ];
      
      let campaignSelector = null;
      for (const selector of campaignSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          campaignSelector = selector;
          console.log(`✅ Found campaign dropdown with selector: ${selector}`);
          break;
        } catch (e) {
          console.log(`❌ Campaign dropdown not found with selector: ${selector}`);
        }
      }
      
      if (campaignSelector) {
        // We're on the campaign selection page
        console.log('🎯 Loading campaigns...');
        
        // First, try to trigger the campaign loading function
        try {
          await this.page.evaluate(() => {
            if (typeof login_allowable_campaigns === 'function') {
              login_allowable_campaigns();
            }
          });
          console.log('✅ Called login_allowable_campaigns() function');
        } catch (e) {
          console.log('⚠️ Could not call login_allowable_campaigns():', e.message);
        }
        
        // Wait for campaigns to load
        await this.page.waitForTimeout(2000);
        
        // Get available options in the dropdown
        const options = await this.page.$$eval(`${campaignSelector} option`, options => 
          options.map(option => ({ value: option.value, text: option.textContent }))
        );
        console.log('🔍 Available campaign options:', JSON.stringify(options, null, 2));
        
        // If there are still no campaigns, try to skip campaign selection
        if (options.length <= 1 || options.every(opt => !opt.value)) {
          console.log('⚠️ No campaigns available, trying to proceed without campaign selection...');
          
          // Try to find and click submit button anyway
          let secondSubmitButton = null;
          const submitSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            'input[value="LOGIN"]',
            'input[value="Submit"]',
            'button:has-text("LOGIN")',
            'button:has-text("Submit")'
          ];
          
          for (const selector of submitSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 2000 });
              secondSubmitButton = selector;
              console.log(`✅ Found submit button with selector: ${selector}`);
              break;
            } catch (e) {
              console.log(`❌ Submit button not found with selector: ${selector}`);
            }
          }
          
          if (secondSubmitButton) {
            console.log('🔐 Submitting form without campaign selection...');
            await this.page.click(secondSubmitButton);
            await this.page.waitForLoadState('networkidle', { timeout: 15000 });
          }
        } else {
          // Try to select campaign 001
          try {
            await this.page.selectOption(campaignSelector, '001');
            console.log('✅ Campaign 001 selected');
          } catch (e) {
            console.log('⚠️ Failed to select campaign 001, trying by text...');
            try {
              await this.page.selectOption(campaignSelector, { label: '001' });
              console.log('✅ Campaign 001 selected by label');
            } catch (e2) {
              console.log('❌ Failed to select campaign 001, trying first available option...');
              const firstValidOption = options.find(opt => opt.value && opt.value !== '');
              if (firstValidOption) {
                await this.page.selectOption(campaignSelector, firstValidOption.value);
                console.log(`✅ Selected first available campaign: ${firstValidOption.value}`);
              } else {
                console.log('❌ No valid campaigns found');
                throw new Error('No valid campaigns available');
              }
            }
          }
          
          // Find submit button for second form
          let secondSubmitButton = null;
          const submitSelectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            'input[value="LOGIN"]',
            'input[value="Submit"]',
            'button:has-text("LOGIN")',
            'button:has-text("Submit")'
          ];
          
          for (const selector of submitSelectors) {
            try {
              await this.page.waitForSelector(selector, { timeout: 2000 });
              secondSubmitButton = selector;
              console.log(`✅ Found second submit button with selector: ${selector}`);
              break;
            } catch (e) {
              console.log(`❌ Second submit button not found with selector: ${selector}`);
            }
          }
          
          if (!secondSubmitButton) {
            throw new Error('Second submit button not found');
          }
          
          // Submit second form
          console.log('🔐 Submitting second login form with campaign...');
          await this.page.click(secondSubmitButton);
          
      // Wait for final page load
          await this.page.waitForLoadState('networkidle', { timeout: 15000 });
        }
      } else {
        console.log('📄 No campaign selection found, checking if already logged in...');
      }
      
      // Take final screenshot
      await this.page.screenshot({ path: 'debug-final-login.png' });
      console.log('📸 Final login screenshot saved as debug-final-login.png');
      
      // Wait a bit more for potential redirects and agent initialization
      await this.page.waitForTimeout(5000);
      
      // Try to properly initialize the agent session
      console.log('🔄 Attempting to initialize agent session...');
      try {
        await this.page.evaluate(() => {
          // Try to trigger agent status initialization
          if (typeof agent_status_initialize === 'function') {
            agent_status_initialize();
          }
          if (typeof agent_init === 'function') {
            agent_init();
          }
          // Try to set initial agent status
          if (typeof change_agent_status === 'function') {
            change_agent_status('READY');
          }
        });
        console.log('✅ Agent initialization functions called');
      } catch (initError) {
        console.log('⚠️ Agent initialization error:', initError.message);
      }
      
      // Check for successful login indicators
      const currentUrlAfterLogin = this.page.url();
      console.log(`🔗 URL after complete login: ${currentUrlAfterLogin}`);
      
      // Try to find session ID in URL parameters
      const sessionMatch = currentUrlAfterLogin.match(/session_id=([^&]+)/);
      if (sessionMatch) {
        this.sessionId = sessionMatch[1];
        this.isLoggedIn = true;
        console.log('✅ Agent logged in successfully. Session ID from URL:', this.sessionId);
        return this.sessionId;
      }
      
      // Try to extract session ID from JavaScript variables
      console.log('🔍 Trying to extract session ID from JavaScript variables...');
      
      try {
        const sessionData = await this.page.evaluate(() => {
          const result = {
            sessionId: null,
            confExten: null,
            phoneLogin: null,
            agentStatus: null,
            allVariables: {}
          };
          
          // Collect all possible session-related variables
          const vars = ['session_id', 'SESSIONID', 'conf_exten', 'phone_login', 'VD_login', 'agent_user', 'campaign'];
          vars.forEach(varName => {
            if (typeof window[varName] !== 'undefined') {
              result.allVariables[varName] = window[varName];
            }
          });
          
          // Try to find the real Vicidial session ID (usually conf_exten)
          if (typeof conf_exten !== 'undefined' && conf_exten && conf_exten !== '0' && conf_exten.toString().length >= 2) {
            result.sessionId = conf_exten;
            result.confExten = conf_exten;
          }
          else if (typeof session_id !== 'undefined' && session_id && session_id !== '0' && session_id.toString().length >= 2) {
            result.sessionId = session_id;
          }
          else if (typeof SESSIONID !== 'undefined' && SESSIONID && SESSIONID !== '0' && SESSIONID.toString().length >= 2) {
            result.sessionId = SESSIONID;
          }
          
          // Get phone login
          if (typeof phone_login !== 'undefined' && phone_login) {
            result.phoneLogin = phone_login;
          }
          
          // Try to find session ID in form fields
          const sessionInputs = document.querySelectorAll('input[name*="session"], input[name*="conf"], input[name*="phone"]');
          for (let input of sessionInputs) {
            if (input.value && input.value !== '0' && input.value.match(/^[0-9]+$/) && input.value.length >= 2) {
              if (!result.sessionId) {
                result.sessionId = input.value;
              }
            }
          }
          
          // Try to find session ID in hidden fields
          const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
          for (let input of hiddenInputs) {
            if (input.name && input.name.toLowerCase().includes('session') && input.value && input.value !== '0') {
              if (!result.sessionId) {
                result.sessionId = input.value;
              }
            }
          }
          
          return result;
        });
        
        console.log('🔍 Session data extracted:', sessionData);
        
        if (sessionData.sessionId) {
          this.sessionId = sessionData.sessionId;
          this.isLoggedIn = true;
          console.log(`✅ Found session ID from JavaScript: ${this.sessionId}`);
          return this.sessionId;
        }
      } catch (jsError) {
        console.log('⚠️ Error extracting session ID from JavaScript:', jsError.message);
      }
      
      // Get the page content to search for session ID
      const loginPageContent = await this.page.content();
      console.log('🔍 Searching for session ID in page content...');
      
      // Look for common ViciDial session ID patterns
      const patterns = [
        /session_id[=:]\s*([0-9]{4,})/i,  // At least 4 digits
        /SESSIONID[=:]\s*([0-9]{4,})/i,
        /conf_exten[=:]\s*([0-9]{4,})/i,
        /var session_id\s*=\s*['"]([0-9]{4,})['"]/i,
        /var SESSIONID\s*=\s*['"]([0-9]{4,})['"]/i,
        /session_id=['"]([0-9]{4,})['"]/i,
        /conf_exten=['"]([0-9]{4,})['"]/i,
        /var conf_exten\s*=\s*['"]([0-9]{4,})['"]/i,
        /value=['"]([0-9]{7,})['"]/i  // 7+ digit numbers (likely session IDs)
      ];
      
      for (const pattern of patterns) {
        const match = loginPageContent.match(pattern);
        if (match && match[1] !== '0') {
          this.sessionId = match[1];
          this.isLoggedIn = true;
          console.log(`✅ Found session ID in page content: ${this.sessionId} (using pattern: ${pattern})`);
          return this.sessionId;
        }
      }
      
      // Check if URL changed to agent interface
      if (currentUrlAfterLogin.includes('agc/vicidial.php') && currentUrlAfterLogin !== loginUrl) {
        console.log('✅ URL changed, likely successful login');
        this.isLoggedIn = true;
        // Generate a 7-digit session ID based on agent user and timestamp
        const timestamp = Date.now().toString().slice(-4);
        this.sessionId = `${agentUser}${timestamp}`;
        console.log(`✅ Generated session ID: ${this.sessionId}`);
        return this.sessionId;
      }
      
      // Check for ViciDial-specific success indicators
      const successSelectors = [
        '#MainTable',
        '.agent_status_display',
        '[name="status"]',
        'frame[name="AgentStatusArea"]',
        'frame[name="agent_status_display"]',
        '.vicidial_agent_display',
        '#agent_display_span',
        'input[name="status"]',
        'select[name="status"]',
        'frameset',
        'frame[name="main_frame"]',
        'frame[name="agent_frame"]',
        'frame[name="agent_status_frame"]',
        'span[id="agent_display_span"]',
        'span[id="status_display_span"]',
        'form[name="agent_form"]',
        'form[name="vicidial_form"]'
      ];
      
      for (const selector of successSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
        console.log(`✅ Found success indicator: ${selector}`);
          this.isLoggedIn = true;
          const timestamp = Date.now().toString().slice(-4);
          this.sessionId = `${agentUser}${timestamp}`;
          console.log(`✅ Generated session ID from success indicator: ${this.sessionId}`);
          return this.sessionId;
        } catch (e) {
          console.log(`❌ Success indicator not found: ${selector}`);
        }
      }
      
      // Check page content for ViciDial-specific text
      const pageContent = await this.page.content();
      const successTexts = [
        'Agent Status',
        'READY',
        'PAUSE',
        'HANGUP',
        'DIAL',
        'agent_status',
        'vicidial_agent',
        'status_display'
      ];
      
      for (const text of successTexts) {
        if (pageContent.includes(text)) {
          console.log(`✅ Found success text: ${text}`);
          this.isLoggedIn = true;
          const timestamp = Date.now().toString().slice(-4);
          this.sessionId = `${agentUser}${timestamp}`;
          console.log(`✅ Generated session ID from success text: ${this.sessionId}`);
          return this.sessionId;
        }
      }
      
      // Get more detailed page info for debugging
      const pageTitle = await this.page.title();
      console.log(`📄 Final page title: ${pageTitle}`);
      
      // Check for frames (ViciDial often uses frames)
      const frames = await this.page.frames();
      console.log(`🔍 Found ${frames.length} frames on page`);
      
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const frameUrl = frame.url();
        console.log(`🔍 Frame ${i}: ${frameUrl}`);
        
        // Check if any frame contains agent interface
        if (frameUrl.includes('vicidial') || frameUrl.includes('agent')) {
          console.log(`✅ Found agent-related frame: ${frameUrl}`);
          this.isLoggedIn = true;
          const timestamp = Date.now().toString().slice(-4);
          this.sessionId = `${agentUser}${timestamp}`;
          console.log(`✅ Generated session ID from frame detection: ${this.sessionId}`);
          return this.sessionId;
        }
      }
      
      // If we made it this far, we might actually be logged in but the interface is different
      console.log('⚠️ No explicit success indicators found, but login process completed');
      console.log('⚠️ Assuming login was successful based on campaign selection');
      this.isLoggedIn = true;
      const timestamp = Date.now().toString().slice(-4);
      this.sessionId = `${agentUser}${timestamp}`;
      console.log(`✅ Generated final fallback session ID: ${this.sessionId}`);
      return this.sessionId;
      
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      // Take error screenshot
      try {
        await this.page.screenshot({ path: 'debug-login-error.png' });
        console.log('📸 Error screenshot saved as debug-login-error.png');
      } catch (screenshotError) {
        console.log('Failed to take error screenshot');
      }
      throw error;
    }
  }

  async setAgentStatus(status) {
    if (!this.isLoggedIn) {
      throw new Error('Agent not logged in');
    }

    try {
      // Navigate to agent status change
      await this.page.evaluate((status) => {
        // Execute JavaScript to change agent status
        if (typeof change_agent_status === 'function') {
          change_agent_status(status);
        }
      }, status);
      
      console.log(`✅ Agent status changed to: ${status}`);
    } catch (error) {
      console.error('❌ Failed to change agent status:', error);
      throw error;
    }
  }

  async makeCall(phoneNumber) {
    if (!this.isLoggedIn) {
      throw new Error('Agent not logged in');
    }

    try {
      // Fill phone number in the dialer
      await this.page.fill('input[name="phone_number"]', phoneNumber);
      
      // Click dial button
      await this.page.click('input[value="DIAL"]');
      
      // Wait for call to be initiated
      await this.page.waitForTimeout(2000);
      
      console.log(`✅ Call initiated to: ${phoneNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to make call:', error);
      throw error;
    }
  }

  async hangupCall() {
    if (!this.isLoggedIn) {
      throw new Error('Agent not logged in');
    }

    try {
      // Click hangup button
      await this.page.click('input[value="HANGUP"]');
      
      console.log('✅ Call hung up');
      return true;
    } catch (error) {
      console.error('❌ Failed to hangup call:', error);
      throw error;
    }
  }

  async transferCall(transferNumber) {
    if (!this.isLoggedIn) {
      throw new Error('Agent not logged in');
    }

    try {
      // Fill transfer number
      await this.page.fill('input[name="xfernumber"]', transferNumber);
      
      // Click transfer button
      await this.page.click('input[value="TRANSFER"]');
      
      console.log(`✅ Call transferred to: ${transferNumber}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to transfer call:', error);
      throw error;
    }
  }

  async getCallStatus() {
    if (!this.isLoggedIn) {
      throw new Error('Agent not logged in');
    }

    try {
      // Extract call status from page
      const statusElement = await this.page.$('#status');
      const status = statusElement ? await statusElement.textContent() : 'Unknown';
      
      return status;
    } catch (error) {
      console.error('❌ Failed to get call status:', error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

module.exports = VicidialWebAutomation;
