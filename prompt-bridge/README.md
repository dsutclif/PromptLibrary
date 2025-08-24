# Prompt Library Bridge

This is a GitHub Pages hosted bridge for importing prompts into the Prompt Library Chrome extension via email links.

## Setup Instructions

1. **Fork or create a GitHub repository**
2. **Enable GitHub Pages** (Settings > Pages > Source: Deploy from branch > main)
3. **Update the extension ID** in `index.html` (line 125): Replace `YOUR_EXTENSION_ID_HERE` with your actual Chrome extension ID
4. **Update the Chrome Web Store link** in `index.html` (line 139): Replace `YOUR_EXTENSION_ID` with your actual extension ID

## How to Create Import Links

### Method 1: Base64 Encoded (Recommended)
```javascript
const promptData = {
    title: "Your Prompt Title",
    body: "Your prompt content here...",
    folderId: null // or specific folder ID
};

const encoded = btoa(JSON.stringify(promptData))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

const link = `https://yourusername.github.io/prompt-bridge/?prompt=${encoded}`;
```

### Method 2: URL Parameters
```
https://yourusername.github.io/prompt-bridge/?title=Example%20Prompt&body=This%20is%20the%20prompt%20content
```

## Email Template Example

```html
<a href="https://yourusername.github.io/prompt-bridge/?prompt=BASE64_DATA_HERE">
    📋 Add This Prompt to Your Library
</a>
```

## Features

- ✅ Extension detection
- ✅ Prompt preview before importing
- ✅ Manual copy-paste fallback
- ✅ Mobile-responsive design
- ✅ Error handling
- ✅ Success feedback

## Testing

1. Create a test link using the methods above
2. Click the link in a browser with the extension installed
3. Verify the prompt appears in your extension library

## Security Notes

- All data is processed client-side
- No server-side storage or logging
- Uses Chrome's standard messaging API
- Requires user interaction to import