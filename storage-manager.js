/**
 * Storage Manager for Save Tabs extension
 * Handles synchronization between local storage and sync storage
 */
class StorageManager {
  constructor() {
    this.syncEnabled = false;
    this.initSyncStatus();
  }
  
  /**
   * Initialize sync status from storage
   */
  async initSyncStatus() {
    try {
      const result = await this.getLocal('syncEnabled');
      this.syncEnabled = result.syncEnabled || false;
    } catch (error) {
      console.error('Error initializing sync status:', error);
      this.syncEnabled = false;
    }
  }
  
  /**
   * Set sync status
   * @param {boolean} enabled - Whether sync is enabled
   */
  async setSyncStatus(enabled) {
    this.syncEnabled = enabled;
    await this.setLocal({ syncEnabled: enabled });
    
    // If sync is enabled, push local data to sync
    if (enabled) {
      await this.pushLocalToSync();
    }
  }
  
  /**
   * Get sync status
   * @returns {boolean} - Whether sync is enabled
   */
  getSyncStatus() {
    return this.syncEnabled;
  }
  
  /**
   * Set UI mode preference
   * @param {string} mode - The UI mode ('basic' or 'advanced')
   */
  async setUIMode(mode) {
    await this.setLocal({ uiMode: mode });
    
    // If sync is enabled, also save to sync storage
    if (this.syncEnabled) {
      try {
        await this.setSync({ uiMode: mode });
      } catch (error) {
        console.error('Error saving UI mode to sync storage:', error);
      }
    }
  }
  
  /**
   * Get UI mode preference
   * @returns {string} - The UI mode ('basic' or 'advanced')
   */
  async getUIMode() {
    // Try to get from sync first if sync is enabled
    if (this.syncEnabled) {
      try {
        const syncData = await this.getSync(['uiMode']);
        if (syncData.uiMode) {
          return syncData.uiMode;
        }
      } catch (error) {
        console.error('Error getting UI mode from sync:', error);
      }
    }
    
    // Fallback to local storage
    const localData = await this.getLocal(['uiMode']);
    return localData.uiMode || 'basic'; // Default to basic mode
  }
  
  /**
   * Set theme preference
   * @param {string} theme - The theme ('light' or 'dark')
   */
  async setTheme(theme) {
    await this.setLocal({ theme: theme });

    // If sync is enabled, also save to sync storage
    if (this.syncEnabled) {
      try {
        await this.setSync({ theme: theme });
      } catch (error) {
        console.error('Error saving theme to sync storage:', error);
      }
    }
  }

  /**
   * Get theme preference
   * @returns {string} - The theme ('light' or 'dark')
   */
  async getTheme() {
    // Try to get from sync first if sync is enabled
    if (this.syncEnabled) {
      try {
        const syncData = await this.getSync(['theme']);
        if (syncData.theme) {
          return syncData.theme;
        }
      } catch (error) {
        console.error('Error getting theme from sync:', error);
      }
    }

    // Fallback to local storage
    const localData = await this.getLocal(['theme']);
    return localData.theme || 'light'; // Default to light mode
  }
  
  /**
   * Push all local data to sync storage
   */
  async pushLocalToSync() {
    try {
      // Get all data from local storage
      const localData = await this.getLocal(['workspaces', 'categories']);
      
      // Ensure data doesn't exceed Chrome sync storage limits
      const dataSize = this.calculateDataSize(localData);
      const MAX_SYNC_STORAGE_SIZE = 102400; // 100 KB in bytes
      
      if (dataSize > MAX_SYNC_STORAGE_SIZE) {
        throw new Error(`Data size (${dataSize} bytes) exceeds sync storage limit (${MAX_SYNC_STORAGE_SIZE} bytes)`);
      }
      
      // Push to sync storage
      await this.setSync(localData);
      
      return { success: true };
    } catch (error) {
      console.error('Error pushing data to sync:', error);
      // Disable sync if there's an error
      this.syncEnabled = false;
      await this.setLocal({ syncEnabled: false });
      return { 
        success: false, 
        error: error.message || 'Error syncing data'
      };
    }
  }
  
  /**
   * Pull data from sync storage to local
   */
  async pullSyncToLocal() {
    try {
      // Get all data from sync storage
      const syncData = await this.getSync(['workspaces', 'categories']);
      
      if (!syncData.workspaces && !syncData.categories) {
        return { success: true, message: 'No data in sync storage' };
      }
      
      // Push to local storage
      await this.setLocal(syncData);
      
      return { success: true };
    } catch (error) {
      console.error('Error pulling data from sync:', error);
      return { 
        success: false, 
        error: error.message || 'Error pulling synced data'
      };
    }
  }
  
  /**
   * Save data to the appropriate storage based on sync setting
   * @param {Object} data - Data to save
   */
  async saveData(data) {
    // Always save to local storage
    await this.setLocal(data);
    
    // If sync is enabled, also save to sync storage
    if (this.syncEnabled) {
      try {
        // Get current sync data
        const syncData = await this.getSync(['workspaces', 'categories']);
        
        // Merge with new data
        const mergedData = {
          workspaces: {
            ...(syncData.workspaces || {}),
            ...(data.workspaces || {})
          },
          categories: [
            ...(syncData.categories || []),
            ...(data.categories || [])
          ]
        };
        
        // Filter out duplicates in categories
        if (mergedData.categories.length > 0) {
          mergedData.categories = [...new Set(mergedData.categories)];
        }
        
        // Only save data that exists in the new data
        const dataToSync = {};
        if (data.workspaces) dataToSync.workspaces = mergedData.workspaces;
        if (data.categories) dataToSync.categories = mergedData.categories;
        
        // Check data size
        const dataSize = this.calculateDataSize(dataToSync);
        const MAX_SYNC_STORAGE_SIZE = 102400; // 100 KB in bytes
        
        if (dataSize > MAX_SYNC_STORAGE_SIZE) {
          throw new Error(`Data size (${dataSize} bytes) exceeds sync storage limit (${MAX_SYNC_STORAGE_SIZE} bytes)`);
        }
        
        // Save to sync storage
        await this.setSync(dataToSync);
        
        return { success: true };
      } catch (error) {
        console.error('Error saving to sync storage:', error);
        // Disable sync if there's an error
        this.syncEnabled = false;
        await this.setLocal({ syncEnabled: false });
        return { 
          success: false, 
          error: error.message || 'Error syncing data',
          syncDisabled: true
        };
      }
    }
    
    return { success: true };
  }
  
  /**
   * Delete data from both storages
   * @param {Object} data - Keys to delete, with values set to null
   */
  async deleteData(data) {
    // Delete from local storage
    await this.removeLocal(Object.keys(data));
    
    // If sync is enabled, also delete from sync storage
    if (this.syncEnabled) {
      try {
        await this.removeSync(Object.keys(data));
      } catch (error) {
        console.error('Error deleting from sync storage:', error);
      }
    }
  }
  
  /**
   * Get workspace data from appropriate storage
   */
  async getWorkspaces() {
    if (this.syncEnabled) {
      try {
        // Try to get from sync first
        const syncData = await this.getSync(['workspaces']);
        if (syncData.workspaces) {
          return syncData.workspaces;
        }
      } catch (error) {
        console.error('Error getting workspaces from sync:', error);
      }
    }
    
    // Fall back to local storage
    const localData = await this.getLocal(['workspaces']);
    return localData.workspaces || {};
  }
  
  /**
   * Get categories from appropriate storage
   */
  async getCategories() {
    if (this.syncEnabled) {
      try {
        // Try to get from sync first
        const syncData = await this.getSync(['categories']);
        if (syncData.categories) {
          return syncData.categories;
        }
      } catch (error) {
        console.error('Error getting categories from sync:', error);
      }
    }
    
    // Fall back to local storage
    const localData = await this.getLocal(['categories']);
    return localData.categories || [];
  }
  
  // Helper methods for Chrome storage
  
  /**
   * Get data from local storage
   * @param {string|array} keys - Keys to get
   * @returns {Promise<Object>} - Storage data
   */
  getLocal(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }
  
  /**
   * Set data in local storage
   * @param {Object} data - Data to set
   * @returns {Promise<void>}
   */
  setLocal(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Remove keys from local storage
   * @param {string|array} keys - Keys to remove
   * @returns {Promise<void>}
   */
  removeLocal(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Get data from sync storage
   * @param {string|array} keys - Keys to get
   * @returns {Promise<Object>} - Storage data
   */
  getSync(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }
  
  /**
   * Set data in sync storage
   * @param {Object} data - Data to set
   * @returns {Promise<void>}
   */
  setSync(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Remove keys from sync storage
   * @param {string|array} keys - Keys to remove
   * @returns {Promise<void>}
   */
  removeSync(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Calculate size of data in bytes
   * @param {Object} data - Data to calculate size for
   * @returns {number} - Size in bytes
   */
  calculateDataSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }
}

// Create singleton instance
const storageManager = new StorageManager();

// Export the singleton
export default storageManager; 