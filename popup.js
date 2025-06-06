document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const workspaceNameInput = document.getElementById('workspace-name');
  const saveTabsButton = document.getElementById('save-tabs');
  const workspacesList = document.getElementById('workspaces-list');
  
  // Load and display saved workspaces
  loadWorkspaces();
  
  // Event listeners
  saveTabsButton.addEventListener('click', saveCurrentTabs);
  
  // Function to save current tabs as a workspace
  function saveCurrentTabs() {
    const workspaceName = workspaceNameInput.value.trim();
    
    if (!workspaceName) {
      alert('Please enter a workspace name.');
      return;
    }
    
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const tabsData = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }));
      
      // Get existing workspaces
      chrome.storage.local.get(['workspaces'], (result) => {
        const workspaces = result.workspaces || {};
        
        // Check if workspace name already exists
        if (workspaces[workspaceName]) {
          if (!confirm(`Workspace "${workspaceName}" already exists. Do you want to overwrite it?`)) {
            return;
          }
        }
        
        // Save the new workspace
        workspaces[workspaceName] = {
          tabs: tabsData,
          createdAt: new Date().toISOString(),
          tabCount: tabsData.length
        };
        
        chrome.storage.local.set({ workspaces }, () => {
          workspaceNameInput.value = '';
          loadWorkspaces();
        });
      });
    });
  }
  
  // Function to load and display saved workspaces
  function loadWorkspaces() {
    chrome.storage.local.get(['workspaces'], (result) => {
      const workspaces = result.workspaces || {};
      
      // Clear the workspaces list
      workspacesList.innerHTML = '';
      
      if (Object.keys(workspaces).length === 0) {
        workspacesList.innerHTML = '<div class="no-workspaces">No saved workspaces yet.</div>';
        return;
      }
      
      // Sort workspaces by creation date (newest first)
      const sortedWorkspaces = Object.entries(workspaces)
        .sort(([, a], [, b]) => new Date(b.createdAt) - new Date(a.createdAt));
      
      // Create and append workspace items
      sortedWorkspaces.forEach(([name, data]) => {
        const workspaceItem = document.createElement('div');
        workspaceItem.className = 'workspace-item';
        
        const workspaceInfo = document.createElement('div');
        workspaceInfo.innerHTML = `
          <div class="workspace-name">${name}</div>
          <div class="workspace-info">${data.tabCount} tabs · ${formatDate(data.createdAt)}</div>
        `;
        
        const workspaceActions = document.createElement('div');
        workspaceActions.className = 'workspace-actions';
        
        const openButton = document.createElement('button');
        openButton.className = 'open-btn';
        openButton.textContent = 'Open';
        openButton.addEventListener('click', () => openWorkspace(name, data));
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteWorkspace(name));
        
        workspaceActions.appendChild(openButton);
        workspaceActions.appendChild(deleteButton);
        
        workspaceItem.appendChild(workspaceInfo);
        workspaceItem.appendChild(workspaceActions);
        
        workspacesList.appendChild(workspaceItem);
      });
    });
  }
  
  // Function to open a workspace
  function openWorkspace(name, data) {
    // Confirm before opening multiple tabs
    if (!confirm(`Open all ${data.tabCount} tabs from "${name}"?`)) {
      return;
    }
    
    // Create new window with all tabs
    chrome.windows.create({}, (newWindow) => {
      // Close the default new tab
      chrome.tabs.query({ windowId: newWindow.id }, (tabs) => {
        const firstTabId = tabs[0].id;
        
        // Create all workspace tabs
        data.tabs.forEach((tab, index) => {
          chrome.tabs.create({
            windowId: newWindow.id,
            url: tab.url,
            active: index === 0
          });
        });
        
        // Remove the default tab after creating all workspace tabs
        chrome.tabs.remove(firstTabId);
      });
    });
  }
  
  // Function to delete a workspace
  function deleteWorkspace(name) {
    if (!confirm(`Are you sure you want to delete the workspace "${name}"?`)) {
      return;
    }
    
    chrome.storage.local.get(['workspaces'], (result) => {
      const workspaces = result.workspaces || {};
      
      if (workspaces[name]) {
        delete workspaces[name];
        
        chrome.storage.local.set({ workspaces }, () => {
          loadWorkspaces();
        });
      }
    });
  }
  
  // Helper function to format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    
    // If today, show time
    if (date.toDateString() === now.toDateString()) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // If yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
    // Otherwise show date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}); 