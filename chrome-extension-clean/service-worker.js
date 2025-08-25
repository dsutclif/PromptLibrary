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
    await storage.set({
      version: 1,
      folders: [], // No default folders - clean start
      prompts: {},
      recentPromptId: null
    });
  }
}

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
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  console.log('🔧 INTERNAL MESSAGE:', message.type);
  
  try {
    switch (message.type) {
      case 'GET_LIBRARY_DATA':
        const data = await storage.get(['folders', 'prompts', 'recentPromptId', 'settings']);
        sendResponse({ success: true, data });
        break;
        
      case 'UPDATE_LIBRARY_DATA':
      case 'SAVE_LIBRARY_DATA': // Handle both message types
        await storage.set(message.data);
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
        
      default:
        console.warn('❓ Unknown internal message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('❌ Error handling internal message:', error);
    sendResponse({ success: false, error: error.message });
  }
  
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

// Initialize storage on startup
initializeStorage();

console.log('🔥 EXTENSION READY - Internal & external messaging supported');