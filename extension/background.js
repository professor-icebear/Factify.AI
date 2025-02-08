// Listen for when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  // Inject the content script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['extension/content.js']
  });
}); 