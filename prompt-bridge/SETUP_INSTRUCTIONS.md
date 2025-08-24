# Setup Instructions for Email Prompt Imports

## Step 1: Get Your Extension ID

1. Load your extension in Chrome (Developer Mode)
2. Copy the Extension ID from `chrome://extensions/`
3. It looks like: `abcdefghijklmnopqrstuvwxyz123456`

## Step 2: Set Up GitHub Pages

1. **Create a GitHub repository** (can be public or private)
   - Name it something like `prompt-library-bridge`

2. **Upload the bridge files** to your repository:
   - `index.html`
   - `README.md` 
   - `link-generator.js`
   - `SETUP_INSTRUCTIONS.md`

3. **Enable GitHub Pages:**
   - Go to repository Settings > Pages
   - Source: "Deploy from a branch"
   - Branch: "main" (or "master")
   - Folder: "/ (root)"
   - Save

4. **Note your GitHub Pages URL:**
   - Will be: `https://YOUR_USERNAME.github.io/REPOSITORY_NAME/`

## Step 3: Configure the Bridge

1. **Update index.html** (line 125):
   ```javascript
   const EXTENSION_ID = 'YOUR_ACTUAL_EXTENSION_ID_HERE';
   ```

2. **Update the Chrome Web Store link** (line 139):
   ```html
   href="https://chrome.google.com/webstore/detail/prompt-library-overlay/YOUR_EXTENSION_ID"
   ```

3. **Update link-generator.js** (line 8):
   ```javascript
   const BASE_URL = 'https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/';
   ```

## Step 4: Test the Setup

1. **Create a test link:**
   ```javascript
   const testPrompt = {
       title: "Test Prompt",
       body: "This is a test prompt to verify the import system works correctly."
   };
   
   // Use your actual GitHub Pages URL
   const link = generateImportLink(testPrompt);
   console.log(link);
   ```

2. **Test the flow:**
   - Open the link in a browser with your extension installed
   - Click "Add to My Library"
   - Check if the prompt appears in your extension

## Step 5: Create Email Import Links

### Method 1: Use the Generator Script
```javascript
const prompt = {
    title: "Your Prompt Title",
    body: "Your prompt content here...",
    tags: ["tag1", "tag2"]
};

const link = generateImportLink(prompt);
const emailHTML = generateEmailHTML(prompt, "Add This Prompt");
```

### Method 2: Manual URL Construction
```
https://YOUR_USERNAME.github.io/REPO_NAME/?prompt=BASE64_ENCODED_DATA
```

## Troubleshooting

### Extension Not Detected
- Check that `EXTENSION_ID` matches exactly
- Verify extension is installed and enabled
- Make sure `externally_connectable` is in manifest.json

### Import Fails
- Check browser console for errors
- Verify prompt data has required fields (title, body)
- Test with a simple prompt first

### GitHub Pages Not Loading
- Wait 5-10 minutes after enabling Pages
- Check repository is public or Pages is enabled for private repos
- Verify all files are committed to the correct branch

## Security Notes

- The bridge page processes all data client-side
- No server-side storage or logging
- Users must explicitly click to import
- All communication uses Chrome's standard messaging API

## Email Template Example

```html
<p>Try this new prompt for your workflow:</p>

<div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 16px 0; background: #f8f9ff;">
    <h3 style="margin: 0 0 12px 0;">AI Code Review Assistant</h3>
    <p style="margin: 0 0 16px 0; color: #6b7280; font-style: italic;">
        Review this code for bugs, performance issues, and best practices...
    </p>
    <a href="https://YOUR_USERNAME.github.io/prompt-bridge/?prompt=ENCODED_DATA_HERE" 
       style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
        📋 Add to My Library
    </a>
</div>
```