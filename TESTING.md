# Testing Instructions for Chrome Web Store Reviewers

## Basic Extension Testing

### 1. Installation Verification
- Load the extension in Chrome
- Verify the extension icon appears in the toolbar
- Check that clicking the icon opens the side panel

### 2. Core Functionality Test
1. **Create a folder**: Click "New Folder" button, enter name, verify creation
2. **Add a prompt**: Click "New Prompt" button, enter title and text, save to folder
3. **Folder organization**: Verify prompts appear in the correct folder
4. **Search functionality**: Use search bar to find prompts by title or content

### 3. LLM Platform Integration
Test on each supported platform:

#### ChatGPT (https://chatgpt.com)
1. Open ChatGPT in a new tab
2. Click extension icon to open side panel
3. Click any prompt to insert it into the chat input
4. Verify text appears in the input field

#### Claude (https://claude.ai)
1. Open Claude in a new tab
2. Click extension icon to open side panel
3. Click any prompt to insert it
4. Verify insertion works correctly

#### Gemini (https://gemini.google.com)
1. Open Gemini in a new tab
2. Test prompt insertion functionality

#### Perplexity (https://perplexity.ai)
1. Open Perplexity in a new tab
2. Test prompt insertion functionality

### 4. Save Active Feature
1. On any LLM platform, type some text in the chat input
2. Click "Save Active" button in the extension panel
3. Verify a modal appears to save the current input as a new prompt

### 5. Scheduled Prompts
1. Click the clock icon (⏰) next to any prompt
2. Set a future time (1-2 minutes ahead for testing)
3. Verify the prompt appears in "Scheduled Prompts" section
4. Wait for scheduled time and verify prompt is submitted

### 6. Export/Import
1. Click export button (download icon) to download library
2. Verify JSON file downloads with current library data
3. Click import button (upload icon) to restore from file
4. Verify library is restored correctly

## Error Handling Tests

### 1. Non-LLM Platform Behavior
1. Open extension on any non-LLM website (e.g., google.com)
2. Verify settings modal appears
3. Select a preferred LLM and verify it opens in new tab

### 2. Offline Behavior
1. Disconnect internet
2. Verify extension continues to work for local operations
3. Verify graceful handling of operations requiring network access

### 3. Permissions Test
1. Verify extension only requests minimal permissions:
   - storage (for local data)
   - activeTab (for current tab access)
   - scripting (for content script injection)  
   - sidePanel (for panel interface)
2. Test permission request flow:
   - Open extension on an LLM site for the first time
   - Verify permission notification appears in address bar
   - Verify helpful guidance appears in the side panel
   - Click extension icon in address bar and grant access
   - Verify prompts now insert directly instead of copying to clipboard

## Security Verification

### 1. No External Requests
- Check network tab in DevTools
- Verify no external API calls are made
- Confirm all data stays local

### 2. Content Script Behavior
- Verify content scripts only inject when extension is used
- Confirm no persistent background monitoring
- Check that scripts only run on supported LLM platforms

### 3. Data Privacy
- Verify all prompts stay in local storage
- Confirm no data transmission to external servers
- Check that extension respects user privacy

## Expected Results
All features should work smoothly without errors. The extension should provide clear feedback for all user actions and handle edge cases gracefully.