// Load and display existing mappings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadMappings();
  
  // Add button click handler
  document.getElementById('addBtn').addEventListener('click', addMapping);
  
  // Allow Enter key to submit
  document.getElementById('url').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addMapping();
  });
});

// Load all mappings from storage
function loadMappings() {
  chrome.storage.local.get(['urlMappings'], (result) => {
    const mappings = result.urlMappings || {};
    displayMappings(mappings);
  });
}

// Display mappings in the list
function displayMappings(mappings) {
  const listElement = document.getElementById('mappingList');
  listElement.innerHTML = '';
  
  if (Object.keys(mappings).length === 0) {
    listElement.innerHTML = '<p style="color: #666; font-size: 12px;">No keywords yet. Add one above!</p>';
    return;
  }
  
  for (const [keyword, url] of Object.entries(mappings)) {
    const item = document.createElement('div');
    item.className = 'mapping-item';
    
    item.innerHTML = `
      <div class="mapping-info">
        <div class="keyword">${keyword}</div>
        <div class="url">${url}</div>
      </div>
      <button class="delete-btn" data-keyword="${keyword}">Delete</button>
    `;
    
    // Add delete button handler
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
      deleteMapping(e.target.dataset.keyword);
    });
    
    listElement.appendChild(item);
  }
}

// Add a new mapping
function addMapping() {
  const keyword = document.getElementById('keyword').value.trim().toLowerCase();
  const url = document.getElementById('url').value.trim();
  
  // Validation
  if (!keyword || !url) {
    alert('Please enter both a keyword and URL');
    return;
  }
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    alert('URL must start with http:// or https://');
    return;
  }
  
  // Load existing mappings, add new one, and save
  chrome.storage.local.get(['urlMappings'], (result) => {
    const mappings = result.urlMappings || {};
    mappings[keyword] = url;
    
    chrome.storage.local.set({ urlMappings: mappings }, () => {
      // Clear inputs
      document.getElementById('keyword').value = '';
      document.getElementById('url').value = '';
      
      // Refresh display
      loadMappings();
    });
  });
}

// Delete a mapping
function deleteMapping(keyword) {
  chrome.storage.local.get(['urlMappings'], (result) => {
    const mappings = result.urlMappings || {};
    delete mappings[keyword];
    
    chrome.storage.local.set({ urlMappings: mappings }, () => {
      loadMappings();
    });
  });
}
