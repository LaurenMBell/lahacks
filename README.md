# Luma Chrome Extension

React-based Chrome extension scaffold for the Luma side panel.

## Run locally

1. Install dependencies with `npm install`
2. Build the extension with `npm run build`
3. Open `chrome://extensions`
4. Enable Developer Mode
5. Click `Load unpacked`
6. Select the `dist` folder

## Included pieces

- React side panel UI in `src/sidepanel`
- Manifest V3 config in `public/manifest.json`
- Background service worker that opens the side panel from the toolbar icon
- Content script placeholder that stores the current page title and URL for the panel
