// Main handler for navigation based on the keyword-URL mapping
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // Load saved keyword-URL pairs from extension storage
  chrome.storage.local.get(['urlMappings'], (result) => {
      const urlMappings = result.urlMappings || {};

      // Retrieve the URL corresponding to the entered keyword (converted to lowercase for consistency)
      let url = urlMappings[text.toLowerCase()];

      // If no mapping exists, default to a Google search using the typed value.
      if (!url) {
          url = "https://www.google.com/search?q=" + encodeURIComponent(text);
      }

      // Navigate to the matched URL
      // In the current tab if disposition is 'currentTab', otherwise open in a new tab
      if (disposition === "currentTab") {
          chrome.tabs.update({ url: url });
      } else {
          chrome.tabs.create({ url: url });
      }
  });
});
