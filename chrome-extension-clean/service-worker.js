console.log('🔥 SERVICE WORKER LOADED');

// Handle extension icon clicks - open side panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('🖱️ Extension icon clicked, opening side panel');
  try {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Handle external messages from bridge pages
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('🌍 EXTERNAL MESSAGE:', message, 'from:', sender.origin);
  
  if (message.type === 'GET_LIBRARY_DATA') {
    // Return mock data for now - could be enhanced later
    sendResponse({
      success: true, 
      data: { 
        folders: [], 
        prompts: {}, 
        message: 'Extension connected!' 
      }
    });
  } else if (message.type === 'IMPORT_EXTERNAL_PROMPT') {
    console.log('📝 Importing prompt:', message.data);
    sendResponse({ success: true, message: 'Prompt imported successfully!' });
  } else {
    sendResponse({ success: true, message: 'Hello from extension!' });
  }
});

console.log('🔥 EXTENSION READY - Click icon to open, bridge pages can connect');