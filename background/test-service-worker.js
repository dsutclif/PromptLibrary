// Minimal test service worker
console.log('🔥 TEST SERVICE WORKER LOADED');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message);
  sendResponse({ success: true, test: 'working' });
});

console.log('✅ Test service worker initialized');