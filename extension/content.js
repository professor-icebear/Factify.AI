// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractContent') {
    try {
      // Remove unwanted elements
      const elementsToRemove = [
        'script',
        'style',
        'meta',
        'link',
        'noscript',
        'iframe',
        'svg',
        'img',
        'video',
        'audio',
        'header',
        'footer',
        'nav',
        '.advertisement',
        '.ads',
        '.cookie-banner',
        '#cookie-banner',
        '.newsletter',
        '.social-share',
        '.comments'
      ];

      // Create a clone of the document body to avoid modifying the actual page
      const bodyClone = document.body.cloneNode(true);
      
      // Remove unwanted elements from the clone
      elementsToRemove.forEach(selector => {
        const elements = bodyClone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // Try to find the main article content first
      const articleSelectors = [
        'article',
        '[role="article"]',
        '.article-content',
        '.article-body',
        '.story-body',
        'main',
        '#main-content',
        '.post-content',
        '.entry-content'
      ];

      let mainContent = '';
      for (const selector of articleSelectors) {
        const element = bodyClone.querySelector(selector);
        if (element) {
          mainContent = element.textContent;
          break;
        }
      }

      // If no main content found, use the entire body content
      if (!mainContent.trim()) {
        mainContent = bodyClone.textContent;
      }

      // Clean up the text
      const cleanText = mainContent
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .replace(/\n+/g, '\n') // Replace multiple newlines with single newline
        .trim();

      // Get the page title and URL
      const pageInfo = {
        title: document.title,
        url: window.location.href,
        content: cleanText
      };

      sendResponse({ success: true, data: pageInfo });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error.message || 'Failed to extract page content' 
      });
    }
  }
  // Return true to indicate we'll send a response asynchronously
  return true;
}); 