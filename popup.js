// Load and display existing mappings when popup opens
document.addEventListener('DOMContentLoaded', () => {
  loadMappings();
  
  // Add button click handler
  document.getElementById('addBtn').addEventListener('click', addMapping);
  
  // Export button click handler
  document.getElementById('exportBtn').addEventListener('click', exportMappings);
  
  // Import button click handler
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('fileInput').click();
  });
  
  // File input change handler
  document.getElementById('fileInput').addEventListener('change', importMappings);
  
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
    listElement.innerHTML = '<div class="empty-state">No keywords yet. Add one above!</div>';
    return;
  }
  
  for (const [keyword, url] of Object.entries(mappings)) {
    const item = document.createElement('div');
    item.className = 'mapping-item';
    
    item.innerHTML = `
      <div class="mapping-info">
        <div class="keyword">${escapeHtml(keyword)}</div>
        <div class="url">${escapeHtml(url)}</div>
      </div>
      <button class="delete-btn" data-keyword="${escapeHtml(keyword)}">Delete</button>
    `;
    
    listElement.appendChild(item);
  }
  
  // Add delete button handlers
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const keyword = e.target.getAttribute('data-keyword');
      deleteMapping(keyword);
    });
  });
}

// Add a new mapping
function addMapping() {
  const keywordInput = document.getElementById('keyword');
  const urlInput = document.getElementById('url');
  
  const keyword = keywordInput.value.trim().toLowerCase();
  const url = urlInput.value.trim();
  
  if (!keyword || !url) {
    showStatus('Please enter both keyword and URL', 'error');
    return;
  }
  
  // Validate URL format
  if (!isValidUrl(url)) {
    showStatus('Please enter a valid URL (must start with http:// or https://)', 'error');
    return;
  }
  
  // Save to storage
  chrome.storage.local.get(['urlMappings'], (result) => {
    const mappings = result.urlMappings || {};
    mappings[keyword] = url;
    
    chrome.storage.local.set({ urlMappings: mappings }, () => {
      keywordInput.value = '';
      urlInput.value = '';
      loadMappings();
      showStatus('Keyword added successfully!', 'success');
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
      showStatus('Keyword deleted successfully!', 'success');
    });
  });
}

// Export mappings to JSON file
function exportMappings() {
  chrome.storage.local.get(['urlMappings'], (result) => {
    const mappings = result.urlMappings || {};
    
    if (Object.keys(mappings).length === 0) {
      showStatus('No keywords to export', 'error');
      return;
    }
    
    // Create JSON blob
    const dataStr = JSON.stringify(mappings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    // Create download link
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `goTab-mappings-${timestamp}.json`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showStatus(`Exported ${Object.keys(mappings).length} keyword(s) successfully!`, 'success');
  });
}

// Import mappings from JSON file
function importMappings(event) {
  const file = event.target.files[0];
  
  if (!file) {
    return;
  }
  
  // Reset file input
  event.target.value = '';
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const importedMappings = JSON.parse(e.target.result);
      
      // Validate the imported data
      if (typeof importedMappings !== 'object' || Array.isArray(importedMappings)) {
        showStatus('Invalid file format. Expected a JSON object.', 'error');
        return;
      }
      
      // Validate each mapping
      for (const [keyword, url] of Object.entries(importedMappings)) {
        if (typeof keyword !== 'string' || typeof url !== 'string') {
          showStatus('Invalid mapping format in file.', 'error');
          return;
        }
        if (!isValidUrl(url)) {
          showStatus(`Invalid URL found for keyword "${keyword}": ${url}`, 'error');
          return;
        }
      }
      
      // Merge with existing mappings (imported mappings will overwrite existing ones with same keyword)
      chrome.storage.local.get(['urlMappings'], (result) => {
        const existingMappings = result.urlMappings || {};
        const mergedMappings = { ...existingMappings, ...importedMappings };
        
        chrome.storage.local.set({ urlMappings: mergedMappings }, () => {
          loadMappings();
          const importCount = Object.keys(importedMappings).length;
          showStatus(`Successfully imported ${importCount} keyword(s)!`, 'success');
        });
      });
      
    } catch (error) {
      showStatus('Error reading file. Please ensure it is a valid JSON file.', 'error');
    }
  };
  
  reader.onerror = function() {
    showStatus('Error reading file.', 'error');
  };
  
  reader.readAsText(file);
}

// Show status message
function showStatus(message, type) {
  const statusElement = document.getElementById('statusMessage');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    statusElement.style.display = 'none';
  }, 3000);
}

// Validate URL format
function isValidUrl(string) {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
