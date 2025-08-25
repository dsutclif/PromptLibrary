console.log('🔥 SERVICE WORKER LOADED');

// Basic storage helper
class Storage {
  async get(keys) {
    return await chrome.storage.local.get(keys);
  }
  
  async set(data) {
    return await chrome.storage.local.set(data);
  }
}

const storage = new Storage();

// Initialize default data if needed
async function initializeStorage() {
  const data = await storage.get(['version']);
  if (!data.version) {
    console.log('🔧 Initializing storage for first time...');
    await storage.set({
      version: 1,
      folders: [], // No default folders - clean start
      prompts: {},
      recentPromptId: null,
      settings: {} // Include settings in initialization
    });
    console.log('✅ Storage initialized');
  }
}

// Initialize storage when service worker starts
initializeStorage();

// Handle extension icon clicks - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🖱️ Extension icon clicked, opening side panel');
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Handle internal messages from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 INTERNAL MESSAGE:', message.type);
  
  // Handle async operations properly
  (async () => {
    try {
      switch (message.type) {
        case 'GET_LIBRARY_DATA':
          console.log('📖 Getting library data from storage...');
          const data = await storage.get(['folders', 'prompts', 'recentPromptId', 'settings']);
          console.log('📖 Retrieved data:', { 
            hasPrompts: !!data.prompts, 
            hasFolders: !!data.folders,
            hasSettings: !!data.settings
          });
          sendResponse({ success: true, data });
          break;
          
        case 'UPDATE_LIBRARY_DATA':
        case 'SAVE_LIBRARY_DATA': // Handle both message types
          console.log('💾 Saving library data to storage...');
          await storage.set(message.data);
          console.log('✅ Data saved successfully');
          sendResponse({ success: true });
          break;
          
        case 'INSERT_PROMPT':
          // Handle prompt insertion into LLM chat windows
          console.log('🚀 Inserting prompt into chat window:', message.text?.substring(0, 50) + '...');
          const insertResult = await handlePromptInsertion(message);
          sendResponse(insertResult);
          break;
          
        case 'READ_CURRENT_INPUT':
          // Handle reading current input from chat window
          console.log('📖 Reading current input from chat window');
          const readResult = await handleReadCurrentInput(message);
          sendResponse(readResult);
          break;
          
        case 'OPEN_LLM_AND_CLOSE_PANEL':
          // Handle LLM navigation from settings modal
          console.log('🌐 Opening LLM and closing panel:', message.llm);
          const navResult = await handleLLMNavigation(message);
          sendResponse(navResult);
          break;
          
        case 'SUBMIT_PROMPT':
          // Handle auto-submit for scheduled prompts
          console.log('📤 Auto-submitting scheduled prompt');
          const submitResult = await handlePromptSubmission(message);
          sendResponse(submitResult);
          break;
          
        case 'SCHEDULE_PROMPT_EXECUTION':
          // Handle scheduling from sidepanel
          console.log('⏰ Setting up scheduled prompt execution');
          const scheduleResult = await handleScheduleExecution(message);
          sendResponse(scheduleResult);
          break;
          
        default:
          console.warn('❓ Unknown internal message type:', message.type);
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('❌ Error handling internal message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true; // Keep async response channel open
});

// Handle prompt insertion into LLM platforms
async function handlePromptInsertion(message) {
  try {
    const tabId = message.tabId || (await getCurrentTab()).id;
    const tab = await chrome.tabs.get(tabId);
    
    // Check if current tab supports LLM insertion
    if (isSupportedLLM(tab.url)) {
      // Inject content script and insert prompt
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script-main.js']
      });
      
      // Wait a moment for script to load, then send prompt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'INSERT_PROMPT',
        text: message.text
      });
      
      return { success: true, method: 'direct', inserted: response?.success };
    } else {
      // Fallback: copy to clipboard
      console.log('📋 Not on LLM site, copying to clipboard');
      return { success: true, method: 'clipboard', message: 'Copied to clipboard' };
    }
  } catch (error) {
    console.error('❌ Failed to insert prompt:', error);
    return { success: false, error: error.message };
  }
}

// Handle reading current input from LLM platforms
async function handleReadCurrentInput(message) {
  try {
    const tabId = message.tabId || (await getCurrentTab()).id;
    const tab = await chrome.tabs.get(tabId);
    
    if (isSupportedLLM(tab.url)) {
      // Inject content script and read input
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script-main.js']
      });
      
      // Wait a moment for script to load, then request current input
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'READ_CURRENT_INPUT'
      });
      
      return { success: true, text: response?.text || '' };
    } else {
      return { success: false, error: 'Not on supported LLM platform' };
    }
  } catch (error) {
    console.error('❌ Failed to read current input:', error);
    return { success: false, error: error.message };
  }
}

// Helper functions
async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isSupportedLLM(url) {
  const supportedDomains = [
    'claude.ai',
    'chatgpt.com',
    'gemini.google.com',
    'perplexity.ai'
  ];
  
  try {
    const urlObj = new URL(url);
    return supportedDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

// Handle LLM navigation from settings modal
async function handleLLMNavigation(message) {
  try {
    const urls = {
      claude: 'https://claude.ai',
      chatgpt: 'https://chatgpt.com',
      gemini: 'https://gemini.google.com',
      perplexity: 'https://www.perplexity.ai'
    };
    
    const url = urls[message.llm];
    if (!url) {
      return { success: false, error: 'Unknown LLM type' };
    }
    
    // Navigate current tab to LLM
    await chrome.tabs.update(message.currentTabId, { url });
    
    console.log(`✅ Navigated to ${message.llm}: ${url}`);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Failed to navigate to LLM:', error);
    return { success: false, error: error.message };
  }
}

// Handle auto-submit for scheduled prompts
async function handlePromptSubmission(message) {
  try {
    const tabId = message.tabId || (await getCurrentTab()).id;
    const tab = await chrome.tabs.get(tabId);
    
    if (isSupportedLLM(tab.url)) {
      // Inject content script and submit
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content-script-main.js']
      });
      
      // Wait a moment for script to load, then submit
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'SUBMIT_PROMPT'
      });
      
      return { success: true, submitted: response?.success };
    } else {
      return { success: false, error: 'Not on supported LLM platform' };
    }
  } catch (error) {
    console.error('❌ Failed to submit prompt:', error);
    return { success: false, error: error.message };
  }
}

// Handle scheduled prompt execution using Chrome alarms for persistence
async function handleScheduleExecution(message) {
  try {
    const { scheduleId, scheduleTime } = message;
    const scheduleDate = new Date(scheduleTime);
    const now = new Date();
    const delayInMinutes = (scheduleDate.getTime() - now.getTime()) / 60000;
    
    if (delayInMinutes <= 0) {
      return { success: false, error: 'Schedule time has passed' };
    }
    
    // Clear existing alarm if updating
    await chrome.alarms.clear(scheduleId);
    
    // Create alarm for scheduled execution
    // Chrome alarms require at least 1 minute delay in production
    // For shorter delays, we'll use the minimum and check the actual time when it fires
    if (delayInMinutes < 1) {
      // For very short delays, set to 1 minute and check time when fired
      chrome.alarms.create(scheduleId, { 
        delayInMinutes: 1,
        periodInMinutes: 0.5 // Check every 30 seconds
      });
    } else {
      chrome.alarms.create(scheduleId, { 
        when: scheduleDate.getTime() 
      });
    }
    
    console.log(`⏰ Scheduled prompt ${scheduleId} will execute at ${scheduleDate.toLocaleString()}`);
    
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to schedule prompt:', error);
    return { success: false, error: error.message };
  }
}

// Execute a scheduled prompt
async function executeScheduledPrompt(scheduleId) {
  try {
    console.log(`🚀 Executing scheduled prompt: ${scheduleId}`);
    
    // Get library data the same way sidepanel saves it
    const data = await storage.get(['scheduled', 'prompts', 'settings']);
    const schedule = data.scheduled?.find(s => s.id === scheduleId);
    
    if (!schedule) {
      console.log(`❌ Schedule ${scheduleId} not found`);
      return;
    }
    
    const prompt = data.prompts?.[schedule.promptId];
    if (!prompt) {
      console.log(`❌ Prompt ${schedule.promptId} not found`);
      return;
    }
    
    // Open side panel first (so user sees what's happening)
    await chrome.sidePanel.open({ windowId: (await chrome.windows.getCurrent()).id });
    
    // Wait a moment for panel to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get current tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentUrl = activeTab ? activeTab.url : '';
    const supportedDomains = ['claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai'];
    const isLLMPlatform = supportedDomains.some(domain => currentUrl.includes(domain));
    
    let targetTabId = activeTab?.id;
    
    // If not on LLM platform, open preferred LLM in new tab
    if (!isLLMPlatform) {
      const llmUrls = {
        claude: 'https://claude.ai',
        chatgpt: 'https://chatgpt.com',
        gemini: 'https://gemini.google.com',
        perplexity: 'https://www.perplexity.ai'
      };
      
      const preferredLLM = data.settings?.goToLLM || 'chatgpt';
      const url = llmUrls[preferredLLM];
      
      if (url) {
        // Open in new tab instead of updating current tab
        const newTab = await chrome.tabs.create({ url, active: true });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for load
        targetTabId = newTab.id;
      }
    }
    
    // Insert the prompt using proper Chrome API
    let insertResult = { success: false };
    
    if (isSupportedLLM((await chrome.tabs.get(targetTabId)).url)) {
      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['content/content-script-main.js']
      });
      
      // Wait for script to load
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Send insert message
      try {
        insertResult = await chrome.tabs.sendMessage(targetTabId, {
          type: 'INSERT_PROMPT',
          text: prompt.body
        });
      } catch (error) {
        console.error('Failed to insert prompt:', error);
      }
    }
    
    if (insertResult.success && schedule.autoSubmit) {
      // Auto-submit if enabled
      setTimeout(async () => {
        try {
          await chrome.tabs.sendMessage(targetTabId, {
            type: 'SUBMIT_PROMPT'
          });
        } catch (error) {
          console.error('Failed to auto-submit:', error);
        }
      }, 500);
    }
    
    // Remove from scheduled list after execution
    const updatedScheduled = (data.scheduled || []).filter(s => s.id !== scheduleId);
    await storage.set({ scheduled: updatedScheduled });
    
    // Clear the alarm
    await chrome.alarms.clear(scheduleId);
    
    console.log(`✅ Scheduled prompt ${scheduleId} executed and removed`);
    
  } catch (error) {
    console.error(`❌ Failed to execute scheduled prompt ${scheduleId}:`, error);
  }
}

// Restore scheduled prompts on startup
async function restoreScheduledPrompts() {
  try {
    // Get data the same way sidepanel saves it
    const data = await storage.get(['scheduled', 'prompts', 'folders', 'settings']);
    const scheduled = data.scheduled || [];
    const now = new Date();
    
    let restoredCount = 0;
    let removedCount = 0;
    const validSchedules = [];
    
    // Clear all existing alarms first
    await chrome.alarms.clearAll();
    
    for (const schedule of scheduled) {
      const scheduleDate = new Date(schedule.scheduleTime);
      
      if (scheduleDate <= now) {
        // Remove expired schedules
        removedCount++;
      } else {
        // Restore active schedules
        validSchedules.push(schedule);
        await handleScheduleExecution({
          scheduleId: schedule.id,
          scheduleTime: schedule.scheduleTime
        });
        restoredCount++;
      }
    }
    
    // Update storage with only valid schedules
    if (removedCount > 0 || validSchedules.length !== scheduled.length) {
      await storage.set({ scheduled: validSchedules });
    }
    
    console.log(`⏰ Restored ${restoredCount} scheduled prompts, removed ${removedCount} expired`);
    
  } catch (error) {
    console.error('❌ Failed to restore scheduled prompts:', error);
  }
}

// Handle external messages from bridge pages
chrome.runtime.onMessageExternal.addListener(async (message, sender, sendResponse) => {
  console.log('🌍 EXTERNAL MESSAGE:', message.type, 'from:', sender.origin);
  
  if (message.type === 'GET_LIBRARY_DATA') {
    const data = await storage.get(['folders', 'prompts']);
    sendResponse({
      success: true, 
      data: data
    });
  } else if (message.type === 'IMPORT_EXTERNAL_PROMPT') {
    console.log('📝 Importing prompt:', message.data);
    
    try {
      // Get current data
      const data = await storage.get(['prompts', 'folders']);
      
      // Create new prompt
      const promptId = 'prm_' + Date.now();
      const newPrompt = {
        id: promptId,
        title: message.data.title || 'Imported Prompt',
        body: message.data.body || '',
        folderId: message.data.folderId || null, // Use folderId from bridge, null = root level
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Add to prompts
      data.prompts[promptId] = newPrompt;
      
      // Ensure folders is an array
      if (!Array.isArray(data.folders)) data.folders = [];
      
      // Save to storage
      await storage.set({ prompts: data.prompts, folders: data.folders });
      
      console.log('✅ Prompt saved to extension library');
      
      // Notify side panel to refresh (if open)
      try {
        await chrome.runtime.sendMessage({ type: 'EXTERNAL_DATA_UPDATED' });
        console.log('📡 Notified side panel of new data');
      } catch (error) {
        // Side panel might not be open - this is OK
        console.log('📡 Side panel not open to receive notification');
      }
      
      sendResponse({ success: true, message: 'Prompt imported successfully!' });
    } catch (error) {
      console.error('❌ Failed to import prompt:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else {
    sendResponse({ success: true, message: 'Hello from extension!' });
  }
});

// Listen for alarms (scheduled prompts)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log('⏰ Alarm fired:', alarm.name);
  
  // Check if this is a scheduled prompt
  const data = await storage.get(['scheduled']);
  const schedule = data.scheduled?.find(s => s.id === alarm.name);
  
  if (schedule) {
    // Check if it's time to execute (for short delays with periodic checks)
    const now = new Date();
    const scheduleTime = new Date(schedule.scheduleTime);
    
    if (scheduleTime <= now) {
      // Execute the scheduled prompt
      await executeScheduledPrompt(alarm.name);
    } else {
      // Not time yet, will check again on next alarm
      console.log(`⏳ Not time yet for ${alarm.name}, scheduled for ${scheduleTime.toLocaleString()}`);
    }
  }
});

// Initialize storage and restore scheduled prompts on startup
initializeStorage();
restoreScheduledPrompts();

console.log('🔥 EXTENSION READY - Internal & external messaging supported');