// Background service worker for Prompt Library extension
//
// CHROME WEB STORE PERMISSION JUSTIFICATIONS:
//
// storage: Required to save user's prompt library, folder organization, 
//          scheduled prompts, and preferences locally on device. No external transmission.
//
// activeTab: Only accesses current active tab when user explicitly clicks extension button.
//            No automatic tab monitoring or background access. Maximum privacy model.
//
// scripting: Dynamically injects content scripts ONLY when user opens extension on
//            supported AI platforms (ChatGPT, Claude, Gemini, Perplexity) to enable
//            prompt insertion. No persistent scripts or background execution.
//
// sidePanel: Provides native Chrome side panel interface for clean user experience
//            without overlaying website content. Standard Chrome extension pattern.

// Supported LLM platforms - single source of truth
const SUPPORTED_DOMAINS = ['claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai'];

// Storage management
class SimpleStorage {
  static async get(key) {
    try {
      const result = await chrome.storage.local.get([key]);
      return result[key] || null;
    } catch (error) {
      console.error('Storage get error:', error);
      return null;
    }
  }

  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  static async remove(key) {
    try {
      await chrome.storage.local.remove([key]);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }
}

// Dynamic content script injection with support for all LLM platforms
async function injectContentScriptIfNeeded(tab) {
  if (!tab || !tab.url) return false;
  
  const isSupported = SUPPORTED_DOMAINS.some(domain => tab.url.includes(domain));
  
  if (!isSupported) {
    return false;
  }
  
  try {
    // First check if content script is already injected
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (response?.success) {
        return true; // Already injected and working
      }
    } catch (pingError) {
      // Script not injected yet, continue with injection
    }

    // Inject the content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/content-script-main.js']
    });
    
    // Wait a moment for initialization
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify injection worked
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      return response?.success || false;
    } catch (verifyError) {
      return false;
    }
  } catch (error) {
    // Handle injection errors
    if (error.message.includes('Cannot access a chrome-extension://') || 
        error.message.includes('Script already exists')) {
      return true; // Script likely already exists
    }
    return false;
  }
}

// Message handling with comprehensive error boundaries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    sendResponse({ success: false, error: 'Invalid message format' });
    return;
  }
  
  switch (message.type) {
    case 'GET_LIBRARY_DATA':
      handleGetLibraryData().then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'SAVE_LIBRARY_DATA':
      handleSaveLibraryData(message.data).then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'INSERT_PROMPT':
      handleInsertPrompt(message.text, message.tabId || sender.tab?.id).then(sendResponse);
      return true;
      
    case 'READ_CURRENT_INPUT':
      handleReadCurrentInput(sender.tab?.id).then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'SUBMIT_PROMPT':
      handleSubmitPrompt(message.tabId || sender.tab?.id).then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'CHECK_LLM_STATUS':
      handleCheckLLMStatus(message.tabId || sender.tab?.id).then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'OPEN_LLM_AND_CLOSE_PANEL':
      handleOpenLLMAndClosePanel(message.llm, message.currentTabId).then(sendResponse);
      return true; // Will respond asynchronously
      
    case 'REFRESH_CONNECTION':
      handleRefreshConnection().then(sendResponse);
      return true; // Will respond asynchronously

    case 'IMPORT_EXTERNAL_PROMPT':
      handleExternalPromptImport(message.data).then(sendResponse);
      return true; // Will respond asynchronously

    // Removed complex permission checking - now handled directly in sidepanel
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
      return;
  }
});

// Action button click handler - opens side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab || !tab.id) {
      throw new Error('Invalid tab context');
    }

    // Always open the side panel first
    await chrome.sidePanel.open({ tabId: tab.id });
    
    // Inject content script if on supported LLM platform (await to ensure it's ready)
    await injectContentScriptIfNeeded(tab);
    
    // Handle smart opening logic for non-LLM platforms
    const currentUrl = tab.url;
    const isLLMPlatform = SUPPORTED_DOMAINS.some(domain => currentUrl.includes(domain));
    
    if (!isLLMPlatform) {
      // Not on LLM platform - check for preferred LLM
      const libraryData = await SimpleStorage.get('promptLibraryData') || {};
      const preferredLLM = libraryData.settings?.goToLLM;
      
      if (preferredLLM) {
        // Has preferred LLM - open it in new tab (prefer chatgpt.com for consistency)
        const urls = {
          claude: 'https://claude.ai',
          chatgpt: 'https://chatgpt.com',
          gemini: 'https://gemini.google.com',
          perplexity: 'https://www.perplexity.ai'
        };
        
        const url = urls[preferredLLM];
        if (url) {
          chrome.tabs.create({ url });
        }
      }
      // If no preferred LLM, side panel will show settings modal automatically
    }
  } catch (error) {
    // Silently handle side panel errors
  }
});

// Message handlers
async function handleGetLibraryData() {
  const data = await SimpleStorage.get('promptLibraryData');
  return {
    success: true,
    data: data || {
      folders: [],
      prompts: {},
      settings: {},
      ui: {}
    }
  };
}

async function handleSaveLibraryData(data) {
  const success = await SimpleStorage.set('promptLibraryData', data);
  return { success };
}

async function handleInsertPrompt(text, tabId) {
  try {
    // Get current active tab if no tabId provided
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }
      tabId = activeTab.id;
    }
    
    // Get tab info and inject content script if needed
    const tab = await chrome.tabs.get(tabId);
    const injected = await injectContentScriptIfNeeded(tab);
    
    if (!injected) {
      // Fallback to clipboard copy for unsupported platforms
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (textToCopy) => {
            navigator.clipboard.writeText(textToCopy);
          },
          args: [text]
        });
        return { success: true, method: 'clipboard', message: 'Copied to clipboard' };
      } catch (clipboardError) {
        return { success: false, error: 'Could not copy to clipboard' };
      }
    }
    
    // Try to send message to content script
    try {
      const response = await chrome.tabs.sendMessage(tabId, { 
        type: 'INSERT_PROMPT', 
        text: text 
      });
      
      if (response?.success) {
        return response;
      } else {
        // Content script failed, try clipboard fallback
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (textToCopy) => {
            navigator.clipboard.writeText(textToCopy);
          },
          args: [text]
        });
        return { success: true, method: 'clipboard', message: 'Copied to clipboard' };
      }
    } catch (messageError) {
      // Message failed, try clipboard fallback
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: (textToCopy) => {
            navigator.clipboard.writeText(textToCopy);
          },
          args: [text]
        });
        return { success: true, method: 'clipboard', message: 'Copied to clipboard' };
      } catch (clipboardError) {
        return { success: false, error: 'Failed to insert prompt and copy to clipboard' };
      }
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleReadCurrentInput(tabId) {
  try {
    // Get current active tab if no tabId provided
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, text: '', error: 'No active tab found' };
      }
      tabId = activeTab.id;
    }
    
    // Get tab info and inject content script if needed
    const tab = await chrome.tabs.get(tabId);
    const injected = await injectContentScriptIfNeeded(tab);
    
    if (!injected) {
      // Fallback: try to read clipboard as alternative
      try {
        const clipboardText = await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            return navigator.clipboard.readText();
          }
        });
        
        const text = clipboardText[0]?.result || '';
        if (text.trim()) {
          return { success: true, text, method: 'clipboard' };
        } else {
          return { success: false, text: '', error: 'Please copy your text first, then try Save Active again, or enter manually' };
        }
      } catch (clipboardError) {
        return { success: false, text: '', error: 'Please copy your text first, then try Save Active again, or enter manually' };
      }
    }
    
    // Try to send message with retry logic
    let response = null;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (attempts < maxAttempts && !response?.success) {
      attempts++;
      
      try {
        response = await chrome.tabs.sendMessage(tabId, { 
          type: 'READ_CURRENT_INPUT'
        });
        
        if (response?.success && response.text?.trim()) {
          return response;
        }
      } catch (messageError) {
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
    
    // Content script failed or returned empty - try clipboard fallback
    try {
      const clipboardText = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          return navigator.clipboard.readText();
        }
      });
      
      const text = clipboardText[0]?.result || '';
      if (text.trim()) {
        return { success: true, text, method: 'clipboard' };
      } else {
        return { success: false, text: '', error: 'Please copy your text first, then try Save Active again, or enter manually' };
      }
    } catch (clipboardError) {
      return { success: false, text: '', error: 'Please copy your text first, then try Save Active again, or enter manually' };
    }
    
  } catch (error) {
    return { success: false, text: '', error: error.message };
  }
}

async function handleSubmitPrompt(tabId) {
  try {
    // Get current active tab if no tabId provided
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, error: 'No active tab found' };
      }
      tabId = activeTab.id;
    }
    
    // Get tab info and inject content script if needed
    const tab = await chrome.tabs.get(tabId);
    await injectContentScriptIfNeeded(tab);
    
    // Wait a moment for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = await chrome.tabs.sendMessage(tabId, { 
      type: 'SUBMIT_PROMPT'
    });
    return response || { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleCheckLLMStatus(tabId) {
  try {
    // Get current active tab if no tabId provided
    if (!tabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, completed: false, error: 'No active tab found' };
      }
      tabId = activeTab.id;
    }
    
    // Get tab info and inject content script if needed
    const tab = await chrome.tabs.get(tabId);
    await injectContentScriptIfNeeded(tab);
    
    // Wait a moment for script to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const response = await chrome.tabs.sendMessage(tabId, { 
      type: 'CHECK_LLM_STATUS'
    });
    return response || { success: true, completed: false };
  } catch (error) {
    return { success: false, completed: false, error: error.message };
  }
}

async function handleOpenLLMAndClosePanel(llmType, currentTabId) {
  const llmUrls = {
    claude: 'https://claude.ai',
    chatgpt: 'https://chatgpt.com',
    gemini: 'https://gemini.google.com',
    perplexity: 'https://www.perplexity.ai'
  };

  const url = llmUrls[llmType];
  if (!url) {
    return { success: false, error: 'Unknown LLM type' };
  }

  try {
    // Open LLM in new tab
    const tab = await chrome.tabs.create({ url, active: true });
    
    // Note: We can't open side panel here because there's no user gesture
    // The user will need to click the extension icon again on the new tab
    // This is intentional to comply with Chrome's security requirements
    
    return { success: true, message: 'LLM opened. Click extension icon to open panel.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleRefreshConnection() {
  try {
    // Get current active tab
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab) {
      return { success: false, error: 'No active tab found' };
    }
    
    // Re-inject content script to refresh connection
    await injectContentScriptIfNeeded(activeTab);
    
    // Wait for script to initialize
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return { success: true, message: 'Connection refreshed' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleExternalPromptImport(promptData) {
  try {
    // Validate prompt data
    if (!promptData || !promptData.title || !promptData.body) {
      return { success: false, error: 'Invalid prompt data - missing title or body' };
    }
    
    // Get existing library data
    const libraryData = await SimpleStorage.get('promptLibraryData') || {
      folders: [],
      prompts: {},
      settings: {},
      ui: {}
    };
    
    // Generate new prompt ID
    const promptId = 'pmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Create new prompt
    const newPrompt = {
      id: promptId,
      title: promptData.title,
      body: promptData.body,
      folderId: promptData.folderId || null,
      created: new Date().toISOString(),
      lastUsed: null,
      tags: promptData.tags || []
    };
    
    // Add to prompts
    if (!libraryData.prompts) libraryData.prompts = {};
    libraryData.prompts[promptId] = newPrompt;
    
    // Add to folder if specified
    if (promptData.folderId) {
      const folder = libraryData.folders?.find(f => f.id === promptData.folderId);
      if (folder) {
        if (!folder.promptIds) folder.promptIds = [];
        folder.promptIds.push(promptId);
      }
    }
    
    // Save to storage
    const saveSuccess = await SimpleStorage.set('promptLibraryData', libraryData);
    
    if (!saveSuccess) {
      return { success: false, error: 'Failed to save prompt to storage' };
    }
    
    return { 
      success: true, 
      promptId: promptId,
      title: newPrompt.title,
      message: 'Prompt added successfully'
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Background service worker successfully initialized

// Monitor tab changes and notify sidepanel about LLM sites
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only check when URL changes and the tab is complete
  if (changeInfo.status === 'complete' && changeInfo.url) {
    const url = changeInfo.url;
    const isLLMSite = url.includes('claude.ai') || 
                      url.includes('chatgpt.com') || 
                      url.includes('gemini.google.com') || 
                      url.includes('perplexity.ai');
    
    if (isLLMSite) {
      // Check if we already have permissions for this domain
      const domain = new URL(url).origin + '/*';
      const hasPermission = await chrome.permissions.contains({
        origins: [domain]
      });
      
      // Notify sidepanel about LLM site navigation
      chrome.runtime.sendMessage({
        type: 'LLM_SITE_DETECTED',
        url: url,
        domain: domain,
        hasPermission: hasPermission
      }).catch(() => {
        // Sidepanel might not be open - that's ok
      });
    }
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const url = tab.url;
      const isLLMSite = url.includes('claude.ai') || 
                        url.includes('chatgpt.com') || 
                        url.includes('gemini.google.com') || 
                        url.includes('perplexity.ai');
      
      if (isLLMSite) {
        const domain = new URL(url).origin + '/*';
        const hasPermission = await chrome.permissions.contains({
          origins: [domain]
        });
        
        chrome.runtime.sendMessage({
          type: 'LLM_SITE_DETECTED',
          url: url,
          domain: domain,
          hasPermission: hasPermission
        }).catch(() => {
          // Sidepanel might not be open - that's ok
        });
      }
    }
  } catch (error) {
    // Tab might not be accessible - that's ok
  }
});

// Removed complex permission checking function - now handled directly in sidepanel for better reliability

console.log('✅ Background service worker initialized');