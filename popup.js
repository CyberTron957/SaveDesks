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
  const updateTabsButton = document.getElementById('update-tabs');
  const workspacesList = document.getElementById('workspaces-list');
  const exportButton = document.getElementById('export-workspaces');
  const importButton = document.getElementById('import-workspaces');
  const importFileInput = document.getElementById('import-file');
  const syncToggle = document.getElementById('sync-toggle');
  
  // Modal Elements
  const updateModal = document.getElementById('update-modal');
  const updateWorkspaceSelect = document.getElementById('update-workspace-select');
  const confirmUpdateButton = document.getElementById('confirm-update');
  const cancelUpdateButton = document.getElementById('cancel-update');
  const closeModalButton = document.querySelector('.close-modal');
  
  // Search state
  let searchTimeout = null;
  
  // Initialize sync toggle
  await initSyncToggle();
  
  // Load categories and workspaces
  loadCategories();
  loadWorkspaces();
  
  // Event listeners
  saveTabsButton.addEventListener('click', saveCurrentTabs);
  updateTabsButton.addEventListener('click', showUpdateModal);
  exportButton.addEventListener('click', exportWorkspaces);
  importButton.addEventListener('click', () => importFileInput.click());
  importFileInput.addEventListener('change', importWorkspaces);
  addCategoryButton.addEventListener('click', addNewCategory);
  categoryFilterSelect.addEventListener('change', loadWorkspaces);
  syncToggle.addEventListener('change', toggleSync);
  
  // Search event listeners
  searchInput.addEventListener('input', debounceSearch);
  clearSearchButton.addEventListener('click', clearSearch);
  
  // Modal event listeners
  confirmUpdateButton.addEventListener('click', updateWorkspace);
  cancelUpdateButton.addEventListener('click', hideUpdateModal);
  closeModalButton.addEventListener('click', hideUpdateModal);
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === updateModal) {
      hideUpdateModal();
    }
  });
  
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
          alert(`Could not enable sync: ${result.error}`);
          syncToggle.checked = false;
        } else {
          alert('Sync enabled! Your workspaces will now sync across devices.');
        }
      } else {
        alert('Sync disabled. Your workspaces will no longer sync across devices.');
      }
    } catch (error) {
      console.error('Error toggling sync:', error);
      alert('Error toggling sync. Please try again.');
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
  
  // Function to show update modal
  function showUpdateModal() {
    // Populate the update select dropdown
    populateUpdateSelect();
    
    // Show the modal
    updateModal.style.display = 'block';
  }
  
  // Function to hide update modal
  function hideUpdateModal() {
    updateModal.style.display = 'none';
  }
  
  // Function to populate the update select dropdown
  async function populateUpdateSelect() {
    // Clear existing options except the first one
    while (updateWorkspaceSelect.options.length > 1) {
      updateWorkspaceSelect.remove(1);
    }
    
    try {
      // Get workspaces
      const workspaces = await storageManager.getWorkspaces();
      
      // Sort workspaces by name
      const sortedNames = Object.keys(workspaces).sort();
      
      // Add workspaces to select
      sortedNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        updateWorkspaceSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Error populating update select:', error);
    }
  }
  
  // Function to update an existing workspace
  async function updateWorkspace() {
    const workspaceName = updateWorkspaceSelect.value;
    
    if (!workspaceName) {
      alert('Please select a workspace to update.');
      return;
    }
    
    try {
      chrome.tabs.query({ currentWindow: true }, async (tabs) => {
        const tabsData = tabs.map(tab => ({
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        }));
        
        // Get existing workspaces
        const workspaces = await storageManager.getWorkspaces();
        
        if (!workspaces[workspaceName]) {
          alert('Workspace not found.');
          hideUpdateModal();
          return;
        }
        
        // Preserve the category
        const category = workspaces[workspaceName].category || '';
        
        // Update the workspace
        workspaces[workspaceName] = {
          tabs: tabsData,
          createdAt: new Date().toISOString(),
          tabCount: tabsData.length,
          category: category,
          updatedAt: new Date().toISOString() // Add updated timestamp
        };
        
        // Save the updated workspaces
        const result = await storageManager.saveData({ workspaces });
        
        if (result.success) {
          loadWorkspaces();
          hideUpdateModal();
          alert(`Workspace "${workspaceName}" has been updated with ${tabsData.length} tabs.`);
        } else {
          alert(`Error updating workspace: ${result.error}`);
          
          if (result.syncDisabled) {
            syncToggle.checked = false;
            alert('Sync has been disabled due to storage limits.');
          }
        }
      });
    } catch (error) {
      console.error('Error updating workspace:', error);
      alert('Error updating workspace. Please try again.');
    }
  }
  
  // Function to load categories
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
        } else {
          alert(`Error saving workspace: ${result.error}`);
          
          if (result.syncDisabled) {
            syncToggle.checked = false;
            alert('Sync has been disabled due to storage limits.');
          }
        }
      } catch (error) {
        console.error('Error saving workspace:', error);
        alert('Error saving workspace. Please try again.');
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
      const workspaces = await storageManager.getWorkspaces();
      const selectedCategory = categoryFilterSelect.value;
      const searchQuery = searchInput.value.trim().toLowerCase();
      
      // Clear the workspaces list
      workspacesList.innerHTML = '';
      
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
            renderWorkspaceItem(name, data, searchQuery);
          });
        });
      } else {
        // For specific category view or search results, just render the workspaces without headers
        sortedWorkspaces.forEach(([name, data]) => {
          renderWorkspaceItem(name, data, searchQuery);
        });
      }
    } catch (error) {
      console.error('Error loading workspaces:', error);
      workspacesList.innerHTML = '<div class="no-workspaces">Error loading workspaces. Please try again.</div>';
    }
  }
  
  // Function to render a workspace item
  function renderWorkspaceItem(name, data, searchQuery = '') {
    const workspaceItem = document.createElement('div');
    workspaceItem.className = 'workspace-item';
    
    // Highlight if it matches the search query
    if (searchQuery && 
        (name.toLowerCase().includes(searchQuery.toLowerCase()) || 
         (data.category && data.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
         data.tabs.some(tab => 
           tab.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
           tab.url.toLowerCase().includes(searchQuery.toLowerCase())
         ))) {
      workspaceItem.classList.add('highlight');
    }
    
    const workspaceInfo = document.createElement('div');
    
    // Add category badge if it exists and we're in "All Categories" view
    let categoryHtml = '';
    if (data.category && categoryFilterSelect.value === 'all') {
      categoryHtml = `<span class="category-badge">${data.category}</span>`;
    }
    
    // Add updated indicator if the workspace has been updated
    let updatedHtml = '';
    if (data.updatedAt) {
      updatedHtml = '<span class="update-indicator">(Updated)</span>';
    }
    
    // Format the name and highlight the search term if it's in the name
    let displayName = name;
    if (searchQuery && name.toLowerCase().includes(searchQuery.toLowerCase())) {
      const regex = new RegExp(`(${searchQuery})`, 'gi');
      displayName = name.replace(regex, '<span class="highlight-text">$1</span>');
    }
    
    workspaceInfo.innerHTML = `
      <div class="workspace-name">${displayName} ${updatedHtml}</div>
      <div class="workspace-info">
        ${categoryHtml}
        ${data.tabCount} tabs · ${formatDate(data.createdAt || data.updatedAt)}
      </div>
    `;
    
    const workspaceActions = document.createElement('div');
    workspaceActions.className = 'workspace-actions';
    
    const previewButton = document.createElement('button');
    previewButton.className = 'preview-btn';
    previewButton.textContent = 'Preview';
    previewButton.title = 'Preview tabs in this workspace';
    previewButton.addEventListener('click', () => previewWorkspace(name, data));
    
    const openButton = document.createElement('button');
    openButton.className = 'open-btn';
    openButton.textContent = 'Open';
    openButton.title = 'Open all tabs in a new window';
    openButton.addEventListener('click', () => openWorkspace(name, data));
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.title = 'Delete this workspace';
    deleteButton.addEventListener('click', () => deleteWorkspace(name));
    
    workspaceActions.appendChild(previewButton);
    workspaceActions.appendChild(openButton);
    workspaceActions.appendChild(deleteButton);
    
    workspaceItem.appendChild(workspaceInfo);
    workspaceItem.appendChild(workspaceActions);
    
    // Create a preview section that will be shown when the preview button is clicked
    const previewSection = document.createElement('div');
    previewSection.className = 'workspace-preview';
    previewSection.style.display = 'none';
    
    workspaceItem.appendChild(previewSection);
    
    workspacesList.appendChild(workspaceItem);
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
  async function deleteWorkspace(name) {
    if (!confirm(`Are you sure you want to delete the workspace "${name}"?`)) {
      return;
    }
    
    try {
      // Get existing workspaces
      const workspaces = await storageManager.getWorkspaces();
      
      if (workspaces[name]) {
        delete workspaces[name];
        
        // Save the updated workspaces
        await storageManager.saveData({ workspaces });
        loadWorkspaces();
      }
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert('Error deleting workspace. Please try again.');
    }
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
  
  // Function to preview a workspace
  function previewWorkspace(name, data) {
    // Find the workspace item and its preview section
    const workspaceItems = document.querySelectorAll('.workspace-item');
    let previewSection = null;
    
    for (const item of workspaceItems) {
      const nameElement = item.querySelector('.workspace-name');
      if (nameElement && nameElement.textContent.includes(name)) {
        previewSection = item.querySelector('.workspace-preview');
        break;
      }
    }
    
    if (!previewSection) return;
    
    // Toggle the preview section
    if (previewSection.style.display === 'none') {
      // Hide all other previews first
      document.querySelectorAll('.workspace-preview').forEach(preview => {
        preview.style.display = 'none';
      });
      
      // Show this preview
      previewSection.style.display = 'block';
      
      // Populate the preview
      previewSection.innerHTML = '';
      
      const previewHeader = document.createElement('div');
      previewHeader.className = 'preview-header';
      previewHeader.textContent = 'Tabs in this workspace:';
      previewSection.appendChild(previewHeader);
      
      const tabsList = document.createElement('div');
      tabsList.className = 'tabs-list';
      
      // Add tabs to the preview list (limited to first 10 for performance)
      const tabsToShow = data.tabs.slice(0, 10);
      tabsToShow.forEach((tab, index) => {
        const tabItem = document.createElement('div');
        tabItem.className = 'tab-item';
        
        const favicon = tab.favIconUrl || 'images/icon16.png';
        
        tabItem.innerHTML = `
          <img src="${favicon}" alt="" class="tab-favicon" onerror="this.src='images/icon16.png'">
          <div class="tab-info">
            <div class="tab-title">${tab.title}</div>
            <div class="tab-url">${truncateUrl(tab.url)}</div>
          </div>
        `;
        
        tabsList.appendChild(tabItem);
      });
      
      // If there are more tabs than we're showing, add a note
      if (data.tabs.length > 10) {
        const moreTabsNote = document.createElement('div');
        moreTabsNote.className = 'more-tabs-note';
        moreTabsNote.textContent = `...and ${data.tabs.length - 10} more tabs`;
        tabsList.appendChild(moreTabsNote);
      }
      
      previewSection.appendChild(tabsList);
    } else {
      // Hide the preview
      previewSection.style.display = 'none';
    }
  }
  
  // Helper function to truncate URL for display
  function truncateUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname === '/' ? '' : '...');
    } catch (e) {
      return url.substring(0, 30) + (url.length > 30 ? '...' : '');
    }
  }
}); 