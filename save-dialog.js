// Import the storage manager
import storageManager from './storage-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const workspaceNameInput = document.getElementById('workspace-name');
  const workspaceCategorySelect = document.getElementById('workspace-category');
  const tabCountSpan = document.getElementById('tab-count');
  const saveButton = document.getElementById('save-button');
  const cancelButton = document.getElementById('cancel-button');
  const syncToggle = document.getElementById('sync-toggle');
  
  // Storage for tabs data
  let tabsData = null;
  let dialogWindowId = null;
  
  // Initialize the dialog
  await initializeDialog();
  
  // Event listeners
  saveButton.addEventListener('click', saveWorkspace);
  cancelButton.addEventListener('click', closeDialog);
  syncToggle.addEventListener('change', toggleSync);
  
  // Enter key to save
  workspaceNameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      saveWorkspace();
    }
  });
  
  // Function to initialize the dialog
  async function initializeDialog() {
    // Generate default workspace name
    const now = new Date();
    const defaultName = `Workspace ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    workspaceNameInput.value = defaultName;
    
    // Load categories
    await loadCategories();
    
    // Initialize sync toggle
    await initSyncToggle();
    
    // Get the temporary tabs data from storage
    chrome.runtime.sendMessage({ action: 'getTempTabsData' }, (response) => {
      if (response) {
        tabsData = response.tabs;
        dialogWindowId = response.windowId;
        
        // Update the tab count display
        if (tabsData) {
          tabCountSpan.textContent = tabsData.length;
        }
      }
    });
  }
  
  // Initialize sync toggle state
  async function initSyncToggle() {
    try {
      // Get sync status from background script
      chrome.runtime.sendMessage({ action: 'getSyncStatus' }, (response) => {
        syncToggle.checked = response.syncEnabled;
      });
    } catch (error) {
      console.error('Error initializing sync toggle:', error);
      syncToggle.checked = false;
    }
  }
  
  // Toggle sync functionality
  async function toggleSync() {
    try {
      await storageManager.setSyncStatus(syncToggle.checked);
    } catch (error) {
      console.error('Error toggling sync:', error);
      syncToggle.checked = !syncToggle.checked; // Revert the toggle
    }
  }
  
  // Function to load categories
  async function loadCategories() {
    try {
      // Get categories from background script
      chrome.runtime.sendMessage({ action: 'getCategories' }, (response) => {
        const categories = response.categories || [];
        
        // Clear existing options except for the first one (No Category)
        while (workspaceCategorySelect.options.length > 1) {
          workspaceCategorySelect.remove(1);
        }
        
        // Add categories to the select
        categories.forEach(category => {
          const option = document.createElement('option');
          option.value = category;
          option.textContent = category;
          workspaceCategorySelect.appendChild(option);
        });
      });
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }
  
  // Function to save the workspace
  function saveWorkspace() {
    const workspaceName = workspaceNameInput.value.trim();
    const category = workspaceCategorySelect.value;
    
    if (!workspaceName) {
      alert('Please enter a workspace name.');
      return;
    }
    
    if (!tabsData) {
      alert('No tabs data available.');
      return;
    }
    
    // Send a message to the background script to save the workspace
    chrome.runtime.sendMessage({
      action: 'saveTabs',
      workspaceName: workspaceName,
      category: category,
      tabsData: tabsData
    }, (response) => {
      if (response && response.success) {
        // Close the dialog
        closeDialog();
        
        // Show a notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: 'Tabs Saved',
          message: `Saved ${tabsData.length} tabs to workspace "${workspaceName}"`
        });
      } else {
        const errorMessage = response && response.error ? response.error : 'Failed to save workspace.';
        alert(errorMessage);
        
        if (response && response.syncDisabled) {
          syncToggle.checked = false;
          alert('Sync has been disabled due to storage limits.');
        }
      }
    });
  }
  
  // Function to close the dialog
  function closeDialog() {
    if (dialogWindowId) {
      chrome.windows.remove(dialogWindowId);
    } else {
      window.close();
    }
  }
}); 