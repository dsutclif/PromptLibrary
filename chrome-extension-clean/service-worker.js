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
      folders: [
        { 
          id: 'fld_root', 
          name: 'Root', 
          parentId: null, 
          childFolderIds: [], 
          promptIds: [] 
        }
      ],
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('🔧 INTERNAL MESSAGE:', message.type);
  
  switch (message.type) {
    case 'GET_LIBRARY_DATA':
      storage.get(['folders', 'prompts', 'recentPromptId']).then(data => {
        sendResponse({ success: true, data });
      });
      return true; // Async response
      
    case 'UPDATE_LIBRARY_DATA':
      storage.set(message.data).then(() => {
        sendResponse({ success: true });
      });
      return true; // Async response
      
    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

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
        parentFolderId: 'fld_root',
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      // Add to prompts
      data.prompts[promptId] = newPrompt;
      
      // Add to root folder
      const rootFolder = data.folders.find(f => f.id === 'fld_root');
      if (rootFolder) {
        rootFolder.promptIds.push(promptId);
      }
      
      // Save to storage
      await storage.set({ prompts: data.prompts, folders: data.folders });
      
      console.log('✅ Prompt saved to extension library');
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