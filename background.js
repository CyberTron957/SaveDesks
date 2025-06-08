// Import the storage manager
import storageManager from './storage-manager.js';

// Security helper function to sanitize strings
function sanitizeString(str) {
  if (!str) return '';
  
  // Create a temporary element
  const tempElement = document.createElement('div');
  // Set the string as text content (which escapes HTML)
  tempElement.textContent = str;
  // Return the escaped HTML
  return tempElement.innerHTML;
}

// Validate URL
function validateUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') ? url : 'about:blank';
  } catch (e) {
    return 'about:blank';
  }
}

// Listen for keyboard commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'save-current-tabs') {
    // Open a dialog to name and save current tabs
    promptToSaveTabs();
  } else if (command === 'open-tab-manager') {
    // Open the tab manager popup
    chrome.action.openPopup();
  }
});

// Function to prompt user to save current tabs
function promptToSaveTabs() {
  // Get current window tabs
  chrome.tabs.query({ currentWindow: true }, (tabs) => {
    const tabsData = tabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl
    }));
    
    // Show a prompt to get workspace name
    const defaultName = `Workspace ${new Date().toLocaleString()}`;
    
    // Create a dialog UI to get the workspace name
    chrome.windows.create({
      url: 'save-dialog.html',
      type: 'popup',
      width: 400,
      height: 250
    }, (window) => {
      // Save the tabs data to local storage temporarily
      // so the dialog page can access it
      chrome.storage.local.set({
        'tempTabsData': {
          tabs: tabsData,
          windowId: window.id
        }
      });
    });
  });
}

// Listen for messages from the save dialog
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Validate that request is an object
  if (!request || typeof request !== 'object') {
    sendResponse({ success: false, error: 'Invalid request format' });
    return true;
  }
  
  if (request.action === 'saveTabs') {
    // Validate required fields
    if (!request.workspaceName || !request.tabsData) {
      sendResponse({ success: false, error: 'Missing required data' });
      return true;
    }
    
    const workspaceName = request.workspaceName;
    const category = request.category || '';
    const tabsData = request.tabsData;
    
    // Validate data types
    if (typeof workspaceName !== 'string' || typeof category !== 'string' || !Array.isArray(tabsData)) {
      sendResponse({ success: false, error: 'Invalid data format' });
      return true;
    }
    
    // Save the workspace
    saveWorkspace(workspaceName, category, tabsData)
      .then(result => {
        sendResponse(result);
        
        // Cleanup temporary data
        chrome.storage.local.remove('tempTabsData');
      })
      .catch(error => {
        console.error('Error saving workspace:', error);
        sendResponse({ 
          success: false, 
          error: error.message || 'Error saving workspace'
        });
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  if (request.action === 'getCategories') {
    storageManager.getCategories()
      .then(categories => {
        sendResponse({ categories });
      })
      .catch(error => {
        console.error('Error getting categories:', error);
        sendResponse({ categories: [] });
      });
    return true;
  }
  
  if (request.action === 'getTempTabsData') {
    chrome.storage.local.get(['tempTabsData'], (result) => {
      sendResponse(result.tempTabsData || null);
    });
    return true;
  }
  
  if (request.action === 'getSyncStatus') {
    sendResponse({ syncEnabled: storageManager.getSyncStatus() });
    return true;
  }
});

// Function to save a workspace
async function saveWorkspace(name, category, tabsData) {
  try {
    // Validate inputs
    if (!name || typeof name !== 'string') {
      throw new Error('Invalid workspace name');
    }
    
    if (typeof category !== 'string') {
      category = '';
    }
    
    if (!Array.isArray(tabsData)) {
      throw new Error('Invalid tabs data');
    }
    
    // Sanitize inputs
    const sanitizedName = sanitizeString(name);
    const sanitizedCategory = sanitizeString(category);
    
    // Sanitize and validate each tab
    const sanitizedTabs = tabsData.map(tab => {
      if (!tab || typeof tab !== 'object') {
        return { url: 'about:blank', title: 'Invalid Tab', favIconUrl: '' };
      }
      
      return {
        url: validateUrl(tab.url),
        title: sanitizeString(tab.title || ''),
        favIconUrl: tab.favIconUrl && typeof tab.favIconUrl === 'string' && 
                   (tab.favIconUrl.startsWith('http:') || tab.favIconUrl.startsWith('https:')) 
                   ? tab.favIconUrl : ''
      };
    });
    
    // Get existing workspaces
    const workspaces = await storageManager.getWorkspaces();
    
    // Add the new workspace
    workspaces[sanitizedName] = {
      tabs: sanitizedTabs,
      createdAt: new Date().toISOString(),
      tabCount: sanitizedTabs.length,
      category: sanitizedCategory
    };
    
    // Save to storage
    const result = await storageManager.saveData({ workspaces });
    
    if (!result.success) {
      throw new Error(result.error || 'Error saving workspace');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error in saveWorkspace:', error);
    return { 
      success: false, 
      error: error.message || 'Error saving workspace'
    };
  }
}

// Listen for changes in sync storage to update local storage
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && storageManager.getSyncStatus()) {
    // Pull the latest data from sync storage
    storageManager.pullSyncToLocal()
      .then(result => {
        if (!result.success) {
          console.error('Error syncing from storage.sync:', result.error);
        }
      })
      .catch(error => {
        console.error('Error in sync listener:', error);
      });
  }
}); 