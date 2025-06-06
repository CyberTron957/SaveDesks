// Import the storage manager
import storageManager from './storage-manager.js';

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const workspaceNameInput = document.getElementById('workspace-name');
  const workspaceCategorySelect = document.getElementById('workspace-category');
  const addCategoryButton = document.getElementById('add-category');
  const categoryFilterSelect = document.getElementById('category-filter');
  const searchInput = document.getElementById('search-workspaces');
  const clearSearchButton = document.getElementById('clear-search');
  const saveTabsButton = document.getElementById('save-tabs');
  const workspacesList = document.getElementById('workspaces-list');
  const exportButton = document.getElementById('export-workspaces');
  const importButton = document.getElementById('import-workspaces');
  const importFileInput = document.getElementById('import-file');
  const syncToggle = document.getElementById('sync-toggle');
  const modeToggle = document.getElementById('mode-toggle');
  const themeToggle = document.getElementById('theme-toggle');
  
  // Custom Dialog Elements
  const customDialog = document.getElementById('custom-dialog');
  const dialogTitle = document.getElementById('dialog-title');
  const dialogMessage = document.getElementById('dialog-message');
  const dialogFooter = document.getElementById('dialog-footer');
  const dialogCloseButton = document.getElementById('dialog-close');
  
  // Search state
  let searchTimeout = null;
  
  // Initialize
  await initSyncToggle();
  await initUIMode();
  await initTheme();
  
  // Load initial data
  loadCategories();
  loadWorkspaces();
  
  // Event listeners
  saveTabsButton.addEventListener('click', saveCurrentTabs);
  exportButton.addEventListener('click', exportWorkspaces);
  importButton.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importWorkspaces);
  addCategoryButton.addEventListener('click', addNewCategory);
  categoryFilterSelect.addEventListener('change', loadWorkspaces);
  syncToggle.addEventListener('change', toggleSync);
  modeToggle.addEventListener('change', toggleUIMode);
  themeToggle.addEventListener('change', toggleTheme);
  
  searchInput.addEventListener('input', debounceSearch);
  clearSearchButton.addEventListener('click', clearSearch);
  
  dialogCloseButton.addEventListener('click', () => customDialog.style.display = 'none');

  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === customDialog) {
      customDialog.style.display = 'none';
    }
  });

  // Reusable dialog function
  function showDialog(title, message, buttons) {
    dialogTitle.textContent = title;
    dialogMessage.textContent = message;
    dialogFooter.innerHTML = ''; // Clear previous buttons

    buttons.forEach(button => {
      const btn = document.createElement('button');
      btn.textContent = button.text;
      btn.className = button.class;
      btn.addEventListener('click', () => {
        customDialog.style.display = 'none';
        if (button.onClick) {
          button.onClick();
        }
      });
      dialogFooter.appendChild(btn);
    });

    customDialog.style.display = 'block';
  }
  
  // Initialize UI mode from storage
  async function initUIMode() {
    try {
      const uiMode = await storageManager.getUIMode();
      const isAdvancedMode = uiMode === 'advanced';
      modeToggle.checked = isAdvancedMode;
      updateUIMode(isAdvancedMode);
    } catch (error) {
      console.error('Error initializing UI mode:', error);
      modeToggle.checked = false;
      updateUIMode(false);
    }
  }
  
  // Toggle between basic and advanced UI modes
  async function toggleUIMode() {
    const isAdvancedMode = modeToggle.checked;
    updateUIMode(isAdvancedMode);
    
    // Save mode preference
    try {
      await storageManager.setUIMode(isAdvancedMode ? 'advanced' : 'basic');
    } catch (error) {
      console.error('Error saving UI mode:', error);
    }
  }
  
  // Update UI based on selected mode
  function updateUIMode(isAdvancedMode) {
    const container = document.querySelector('.container');
    
    if (isAdvancedMode) {
      container.classList.remove('basic-mode');
    } else {
      container.classList.add('basic-mode');
    }
  }
  
  // Initialize sync toggle state
  async function initSyncToggle() {
    try {
      const syncEnabled = await storageManager.getSyncStatus();
      syncToggle.checked = syncEnabled;
      
      // If sync is enabled, make sure data is synced
      if (syncEnabled) {
        // Pull latest data from sync storage
        const result = await storageManager.pullSyncToLocal();
        if (!result.success) {
          console.error('Error pulling data from sync:', result.error);
        }
      }
    } catch (error) {
      console.error('Error initializing sync toggle:', error);
      syncToggle.checked = false;
    }
  }
  
  // Toggle sync functionality
  async function toggleSync() {
    const syncEnabled = syncToggle.checked;
    
    try {
      await storageManager.setSyncStatus(syncEnabled);
      
      if (syncEnabled) {
        // Show a message to the user
        const result = await storageManager.pushLocalToSync();
        if (!result.success) {
          showDialog('Sync Error', `Could not enable sync: ${result.error}`, [{ text: 'OK', class: 'btn-primary' }]);
          syncToggle.checked = false;
        } else {
          showDialog('Sync Enabled', 'Your workspaces will now sync across devices.', [{ text: 'OK', class: 'btn-primary' }]);
        }
      } else {
        showDialog('Sync Disabled', 'Your workspaces will no longer sync across devices.', [{ text: 'OK', class: 'btn-primary' }]);
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      showDialog('Error', 'Error toggling sync. Please try again.', [{ text: 'OK', class: 'btn-primary' }]);
      syncToggle.checked = !syncEnabled; // Revert the toggle
    }
  }
  
  // Function to debounce search input
  function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      loadWorkspaces();
    }, 300);
  }
  
  // Function to clear search
  function clearSearch() {
    searchInput.value = '';
    loadWorkspaces();
  }
  
  // Function to update an existing workspace
  async function updateWorkspace(name) {
    showDialog('Confirm Update', `Are you sure you want to update "${name}" with your current tabs?`, [
      {
        text: 'Update',
        class: 'update-btn',
        onClick: async () => {
          try {
            chrome.tabs.query({ currentWindow: true }, async (tabs) => {
              const tabsData = tabs.map(tab => ({
                url: tab.url,
                title: tab.title,
                favIconUrl: tab.favIconUrl
              }));
              
              const workspaces = await storageManager.getWorkspaces();
              
              if (!workspaces[name]) {
                showDialog('Error', 'Workspace not found.', [{ text: 'OK', class: 'btn-primary' }]);
                return;
              }
              
              const category = workspaces[name].category || '';
              
              workspaces[name] = {
                tabs: tabsData,
                createdAt: workspaces[name].createdAt, // Preserve original creation date
                tabCount: tabsData.length,
                category: category,
                updatedAt: new Date().toISOString()
              };
              
              const result = await storageManager.saveData({ workspaces });
              
              if (result.success) {
                loadWorkspaces();
                showDialog('Success', `Workspace "${name}" has been updated.`, [{ text: 'OK', class: 'btn-primary' }]);
              } else {
                 showDialog('Error', `Error updating workspace: ${result.error}`, [{ text: 'OK', class: 'btn-primary' }]);
              }
            });
          } catch (error) {
            console.error('Error updating workspace:', error);
            showDialog('Error', 'An error occurred while updating the workspace.', [{ text: 'OK', class: 'btn-primary' }]);
          }
        }
      },
      {
        text: 'Cancel',
        class: 'btn-secondary'
      }
    ]);
  }
  
  // Function to load categories into select dropdowns
  async function loadCategories() {
    try {
      const categories = await storageManager.getCategories();
      
      // Clear existing options except for the first one (No Category)
      while (workspaceCategorySelect.options.length > 1) {
        workspaceCategorySelect.remove(1);
      }
      
      while (categoryFilterSelect.options.length > 2) {
        categoryFilterSelect.remove(2);
      }
      
      // Add categories to both selects
      categories.forEach(category => {
        // Add to workspace category select
        const option1 = document.createElement('option');
        option1.value = category;
        option1.textContent = category;
        workspaceCategorySelect.appendChild(option1);
        
        // Add to filter select
        const option2 = document.createElement('option');
        option2.value = category;
        option2.textContent = category;
        categoryFilterSelect.appendChild(option2);
      });
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }
  
  // Function to add a new category
  async function addNewCategory() {
    const newCategory = prompt('Enter a new category name:');
    
    if (!newCategory || newCategory.trim() === '') {
      return;
    }
    
    try {
      const categories = await storageManager.getCategories();
      
      // Check if category already exists
      if (categories.includes(newCategory)) {
        alert('This category already exists.');
        return;
      }
      
      // Add new category
      categories.push(newCategory);
      
      // Save updated categories
      const result = await storageManager.saveData({ categories });
      
      if (result.success) {
        loadCategories();
        
        // Select the new category
        workspaceCategorySelect.value = newCategory;
      } else {
        alert(`Error adding category: ${result.error}`);
        
        if (result.syncDisabled) {
          syncToggle.checked = false;
          alert('Sync has been disabled due to storage limits.');
        }
      }
    } catch (error) {
      console.error('Error adding category:', error);
      alert('Error adding category. Please try again.');
    }
  }
  
  // Function to save current tabs as a workspace
  function saveCurrentTabs() {
    const workspaceName = workspaceNameInput.value.trim();
    const category = workspaceCategorySelect.value;
    
    if (!workspaceName) {
      alert('Please enter a workspace name.');
      return;
    }
    
    chrome.tabs.query({ currentWindow: true }, async (tabs) => {
      const tabsData = tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }));
      
      try {
        // Get existing workspaces
        const workspaces = await storageManager.getWorkspaces();
        
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
          tabCount: tabsData.length,
          category: category
        };
        
        // Save the updated workspaces
        const result = await storageManager.saveData({ workspaces });
        
        if (result.success) {
          workspaceNameInput.value = '';
          loadWorkspaces();
          showDialog('Success', `Workspace "${workspaceName}" saved with ${tabs.length} tabs.`, [{ text: 'OK', class: 'btn-primary' }]);
        } else {
          showDialog('Error', `Error saving workspace: ${result.error}`, [{ text: 'OK', class: 'btn-primary' }]);
          
          if (result.syncDisabled) {
            syncToggle.checked = false;
            alert('Sync has been disabled due to storage limits.');
          }
        }
      } catch (error) {
        console.error('Error saving workspace:', error);
        showDialog('Error', 'Error saving workspace. Please try again.', [{ text: 'OK', class: 'btn-primary' }]);
      }
    });
  }
  
  // Function to export all workspaces to a JSON file
  async function exportWorkspaces() {
    try {
      // Get workspaces and categories from storage
      const workspaces = await storageManager.getWorkspaces();
      const categories = await storageManager.getCategories();
      
      if (Object.keys(workspaces).length === 0) {
        alert('No workspaces to export.');
        return;
      }
      
      // Create export data with both workspaces and categories
      const exportData = {
        workspaces: workspaces,
        categories: categories
      };
      
      // Create a blob with the data
      const exportJson = JSON.stringify(exportData, null, 2);
      const blob = new Blob([exportJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `save-tabs-export-${formatDateForFilename(new Date())}.json`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      console.error('Error exporting workspaces:', error);
      alert('Error exporting workspaces. Please try again.');
    }
  }
  
  // Function to import workspaces from a JSON file
  function importWorkspaces(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        const importedWorkspaces = importedData.workspaces || importedData; // Support both new and old format
        const importedCategories = importedData.categories || [];
        
        // Validate imported workspaces
        if (typeof importedWorkspaces !== 'object' || importedWorkspaces === null) {
          throw new Error('Invalid workspaces data format.');
        }
        
        // Check if each workspace has the required properties
        for (const [name, workspace] of Object.entries(importedWorkspaces)) {
          if (!Array.isArray(workspace.tabs) || 
              !workspace.createdAt || 
              typeof workspace.tabCount !== 'number') {
            throw new Error(`Workspace "${name}" has invalid format.`);
          }
        }
        
        // Get existing workspaces and categories
        const existingWorkspaces = await storageManager.getWorkspaces();
        const existingCategories = await storageManager.getCategories();
        const duplicateNames = Object.keys(importedWorkspaces).filter(name => existingWorkspaces[name]);
        
        // Check for duplicates
        if (duplicateNames.length > 0) {
          const overwrite = confirm(`${duplicateNames.length} workspace(s) with the same name already exist. Do you want to overwrite them?`);
          
          if (!overwrite) {
            // Remove duplicates from imported workspaces
            duplicateNames.forEach(name => {
              delete importedWorkspaces[name];
            });
          }
        }
        
        // Merge workspaces
        const mergedWorkspaces = { ...existingWorkspaces, ...importedWorkspaces };
        
        // Merge categories
        const mergedCategories = [...new Set([...existingCategories, ...importedCategories])];
        
        // Save merged data
        const result = await storageManager.saveData({ 
          workspaces: mergedWorkspaces,
          categories: mergedCategories
        });
        
        if (result.success) {
          loadCategories();
          loadWorkspaces();
          alert(`Successfully imported ${Object.keys(importedWorkspaces).length} workspace(s) and ${importedCategories.length} categories.`);
        } else {
          alert(`Error importing data: ${result.error}`);
          
          if (result.syncDisabled) {
            syncToggle.checked = false;
            alert('Sync has been disabled due to storage limits.');
          }
        }
        
        // Reset file input
        importFileInput.value = '';
      } catch (error) {
        alert(`Error importing data: ${error.message}`);
        importFileInput.value = '';
      }
    };
    
    reader.readAsText(file);
  }
  
  // Helper function to format date for filenames
  function formatDateForFilename(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Function to load and display saved workspaces
  async function loadWorkspaces() {
    try {
      // Clear any existing workspaces from the UI
      workspacesList.innerHTML = '';
      
      // Force refresh from storage
      const workspaces = await storageManager.getWorkspaces();
      const selectedCategory = categoryFilterSelect.value;
      const searchQuery = searchInput.value.trim().toLowerCase();
      
      if (Object.keys(workspaces).length === 0) {
        workspacesList.innerHTML = '<div class="no-workspaces">No saved workspaces yet.</div>';
        return;
      }
      
      // Filter workspaces by category and search query
      let filteredWorkspaces = Object.entries(workspaces);
      
      // Apply category filter
      if (selectedCategory !== 'all') {
        filteredWorkspaces = filteredWorkspaces.filter(([, data]) => 
          (selectedCategory === '' && (!data.category || data.category === '')) || 
          data.category === selectedCategory
        );
      }
      
      // Apply search filter if there's a search query
      if (searchQuery) {
        filteredWorkspaces = filteredWorkspaces.filter(([name, data]) => {
          // Search in workspace name
          if (name.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Search in category
          if (data.category && data.category.toLowerCase().includes(searchQuery)) {
            return true;
          }
          
          // Search in tab titles
          if (data.tabs.some(tab => tab.title.toLowerCase().includes(searchQuery))) {
            return true;
          }
          
          // Search in tab URLs
          if (data.tabs.some(tab => tab.url.toLowerCase().includes(searchQuery))) {
            return true;
          }
          
          return false;
        });
      }
      
      if (filteredWorkspaces.length === 0) {
        workspacesList.innerHTML = '<div class="no-workspaces">No matching workspaces found.</div>';
        return;
      }
      
      // Sort workspaces by creation date (newest first)
      const sortedWorkspaces = filteredWorkspaces.sort(([, a], [, b]) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      // Group workspaces by category only if we're not searching
      if (!searchQuery && selectedCategory === 'all') {
        // Group workspaces by category
        const groupedWorkspaces = {};
        
        // First add "No Category" group
        groupedWorkspaces[''] = [];
        
        // Then add other categories from the sorted workspaces
        sortedWorkspaces.forEach(([name, data]) => {
          const category = data.category || '';
          if (!groupedWorkspaces[category]) {
            groupedWorkspaces[category] = [];
          }
          groupedWorkspaces[category].push([name, data]);
        });
        
        // Render each category group
        Object.entries(groupedWorkspaces).forEach(([category, workspaces]) => {
          if (workspaces.length === 0) return;
          
          // Add category header
          const categoryHeader = document.createElement('div');
          categoryHeader.className = 'category-header';
          categoryHeader.textContent = category || 'No Category';
          workspacesList.appendChild(categoryHeader);
          
          // Render workspaces in this category
          workspaces.forEach(([name, data]) => {
            const workspaceItem = renderWorkspaceItem(name, data, searchQuery);
            workspacesList.appendChild(workspaceItem);
          });
        });
      } else {
        // For specific category view or search results, just render the workspaces without headers
        sortedWorkspaces.forEach(([name, data]) => {
          const workspaceItem = renderWorkspaceItem(name, data, searchQuery);
          workspacesList.appendChild(workspaceItem);
        });
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      workspacesList.innerHTML = '<div class="no-workspaces">Error loading workspaces. Please try again.</div>';
    }
  }
  
  // Function to render a workspace item
  function renderWorkspaceItem(name, data, searchQuery = '') {
    const item = document.createElement('div');
    item.className = 'workspace-item';
    
    let highlightedName = name;
    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'gi');
      highlightedName = highlightedName.replace(regex, (match) => `<span class="highlight-text">${match}</span>`);
    }

    item.innerHTML = `
      <div>
        <span class="workspace-name">${highlightedName}</span>
        <div class="workspace-info">
          <span class="tab-count">${data.tabCount} tabs</span> |
          <span class="date">Saved on ${formatDate(data.createdAt)}</span>
          ${data.category ? `<span class="category-badge">${data.category}</span>` : ''}
          ${data.updatedAt ? `<span class="update-indicator">Updated on ${formatDate(data.updatedAt)}</span>` : ''}
        </div>
      </div>
      <div class="workspace-actions">
        <button class="open-btn" title="Open Workspace"><i class="bi bi-folder2-open"></i></button>
        <button class="update-btn" title="Update Workspace"><i class="bi bi-arrow-clockwise"></i></button>
        <button class="preview-btn" title="Preview Tabs"><i class="bi bi-eye"></i></button>
        <button class="export-btn advanced-feature" title="Export Workspace"><i class="bi bi-download"></i></button>
        <button class="delete-btn" title="Delete Workspace"><i class="bi bi-trash"></i></button>
      </div>
    `;

    // Event listeners for workspace actions
    item.querySelector('.open-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openWorkspace(name, data);
    });
    item.querySelector('.update-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        updateWorkspace(name);
    });
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteWorkspace(name);
    });
    item.querySelector('.preview-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      previewWorkspace(name, data, item);
    });
    item.querySelector('.export-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        exportSingleWorkspace(name, data);
    });

    item.addEventListener('click', () => openWorkspace(name, data));

    return item;
  }
  
  // Function to open all tabs in a workspace
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
  async function deleteWorkspace(name) {
    showDialog('Confirm Deletion', `Are you sure you want to delete "${name}"? This action cannot be undone.`, [
      {
        text: 'Delete',
        class: 'delete-btn',
        onClick: async () => {
          try {
            const workspaces = await storageManager.getWorkspaces();
            
            if (!workspaces[name]) {
              showDialog('Error', 'Workspace not found.', [{ text: 'OK', class: 'btn-primary' }]);
              return;
            }
            
            // Create a deep copy of workspaces without the one to be deleted
            const updatedWorkspaces = {};
            for (const [wsName, wsData] of Object.entries(workspaces)) {
              if (wsName !== name) {
                updatedWorkspaces[wsName] = wsData;
              }
            }
            
            // Replace entire workspaces object
            await storageManager.setLocal({ workspaces: updatedWorkspaces });
            
            // Also update sync storage if enabled
            if (storageManager.getSyncStatus()) {
              await storageManager.setSync({ workspaces: updatedWorkspaces });
            }
            
            // Refresh the UI
            await loadWorkspaces();
            
            showDialog('Success', `Workspace "${name}" has been deleted.`, [{ text: 'OK', class: 'btn-primary' }]);
          } catch (error) {
            console.error('Error deleting workspace:', error);
            showDialog('Error', 'An error occurred while deleting the workspace.', [{ text: 'OK', class: 'btn-primary' }]);
          }
        }
      },
      {
        text: 'Cancel',
        class: 'btn-secondary'
      }
    ]);
  }
  
  // Function to format a date string
  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  // Function to preview tabs in a workspace
  function previewWorkspace(name, data, workspaceItem) {
    const nextElement = workspaceItem.nextElementSibling;

    // If the next element is a preview, it means we're toggling the same item's preview off.
    if (nextElement && nextElement.classList.contains('workspace-preview-container')) {
      nextElement.remove();
      return;
    }

    // If another preview is open somewhere else, close it.
    const anyOpenPreview = document.querySelector('.workspace-preview-container');
    if (anyOpenPreview) {
      anyOpenPreview.remove();
    }

    const previewContainer = document.createElement('div');
    previewContainer.className = 'workspace-preview-container';

    let tabsHtml = data.tabs.slice(0, 10).map(tab => `
      <div class="tab-item">
        <img src="${tab.favIconUrl || 'images/icon16.png'}" class="tab-favicon" alt="">
        <div class="tab-info">
          <div class="tab-title">${tab.title || 'No Title'}</div>
          <div class="tab-url">${truncateUrl(tab.url)}</div>
        </div>
      </div>
    `).join('');

    if (data.tabs.length > 10) {
      tabsHtml += `<div class="more-tabs-note">... and ${data.tabs.length - 10} more tabs</div>`;
    }

    previewContainer.innerHTML = `
      <div class="workspace-preview">
        <div class="preview-header">Previewing "${name}"</div>
        <div class="tabs-list">${tabsHtml}</div>
      </div>
    `;
    
    // Insert the preview container *after* the workspace item.
    workspaceItem.after(previewContainer);
  }
  
  // Function to truncate a URL for display
  function truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname === '/' ? '' : '...');
    } catch (e) {
      return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
  }
  
  // Export a single workspace
  async function exportSingleWorkspace(name, data) {
    try {
      const workspaceObj = {};
      workspaceObj[name] = data;
      
      const blob = new Blob([JSON.stringify(workspaceObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const date = new Date();
      const filename = `${name.replace(/[^a-z0-9]/gi, '_')}_${formatDateForFilename(date)}.json`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting workspace:', error);
      alert('Error exporting workspace. Please try again.');
    }
  }

  // Initialize Theme from storage
  async function initTheme() {
    try {
      const theme = await storageManager.getTheme();
      const isDarkMode = theme === 'dark';
      themeToggle.checked = isDarkMode;
      updateTheme(isDarkMode);
    } catch (error) {
      console.error('Error initializing theme:', error);
      themeToggle.checked = false;
      updateTheme(false);
    }
  }

  // Toggle between light and dark themes
  async function toggleTheme() {
    const isDarkMode = themeToggle.checked;
    updateTheme(isDarkMode);

    // Save theme preference
    try {
      await storageManager.setTheme(isDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }

  // Update UI based on selected theme
  function updateTheme(isDarkMode) {
    if (isDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}); 