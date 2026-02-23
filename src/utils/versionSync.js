import { db } from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

class VersionSync {
  constructor() {
    this.appVersion = '1.0.0'; // Current app version
    this.localVersion = localStorage.getItem('app_version') || '0.0.0';
    this.syncInterval = null;
    this.listeners = new Set();
    this.isSyncing = false;
    this.lastSyncTime = localStorage.getItem('last_sync_time') || 0;
  }

  // Initialize version synchronization
  init() {
    // Set up Firestore listener for version changes
    this.setupVersionListener();
    
    // Start periodic sync every 30 seconds
    this.startPeriodicSync();
    
    // Listen for online/offline events
    this.setupNetworkListeners();
    
    // Initial sync
    this.syncVersion();
  }

  // Set up Firestore listener for version changes
  setupVersionListener() {
    const versionRef = doc(db, 'app_state', 'version');
    
    this.unsubscribe = onSnapshot(versionRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const remoteVersion = data.version || '0.0.0';
        const remoteTimestamp = data.timestamp?.toMillis() || 0;
        
        // Check if remote version is newer
        if (this.compareVersions(remoteVersion, this.localVersion) > 0) {
          this.handleVersionUpdate(remoteVersion, remoteTimestamp);
        }
      }
    }, (error) => {
      console.error('Version sync error:', error);
    });
  }

  // Start periodic synchronization
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (navigator.onLine) {
        this.syncVersion();
      }
    }, 30000); // Sync every 30 seconds
  }

  // Set up network event listeners
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Network online - syncing version');
      this.syncVersion();
    });

    window.addEventListener('offline', () => {
      console.log('Network offline - using cached version');
    });
  }

  // Sync local version with Firestore
  async syncVersion() {
    if (this.isSyncing || !navigator.onLine) return;
    
    this.isSyncing = true;
    
    try {
      const versionRef = doc(db, 'app_state', 'version');
      const now = Date.now();
      
      // Update Firestore with current version
      await setDoc(versionRef, {
        version: this.appVersion,
        timestamp: serverTimestamp(),
        lastUpdated: now
      }, { merge: true });
      
      // Update local storage
      this.updateLocalVersion(this.appVersion);
      this.lastSyncTime = now;
      localStorage.setItem('last_sync_time', now.toString());
      
      console.log('Version synced:', this.appVersion);
      
      // Notify listeners
      this.notifyListeners('synced', this.appVersion);
      
    } catch (error) {
      console.error('Version sync failed:', error);
      this.notifyListeners('sync_failed', error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  // Handle version updates from Firestore
  handleVersionUpdate(remoteVersion, remoteTimestamp) {
    const localTimestamp = parseInt(localStorage.getItem('last_sync_time') || '0');
    
    // Only update if remote version is newer or timestamp is more recent
    if (this.compareVersions(remoteVersion, this.localVersion) > 0 || 
        remoteTimestamp > localTimestamp) {
      
      console.log('Version update detected:', {
        local: this.localVersion,
        remote: remoteVersion,
        localTime: localTimestamp,
        remoteTime: remoteTimestamp
      });
      
      this.updateLocalVersion(remoteVersion);
      this.notifyListeners('version_updated', {
        oldVersion: this.localVersion,
        newVersion: remoteVersion,
        source: 'remote'
      });
    }
  }

  // Update local version and storage
  updateLocalVersion(version) {
    this.localVersion = version;
    localStorage.setItem('app_version', version);
    localStorage.setItem('last_sync_time', Date.now().toString());
  }

  // Compare version strings (e.g., "1.0.0" vs "1.0.1")
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  // Add listener for version changes
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Listener error:', error);
      }
    });
  }

  // Get current version
  getCurrentVersion() {
    return this.localVersion;
  }

  // Check if app is up to date
  isUpToDate() {
    return this.compareVersions(this.appVersion, this.localVersion) <= 0;
  }

  // Force version update (for testing)
  async forceUpdate() {
    await this.syncVersion();
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.listeners.clear();
  }
}

// Create singleton instance
const versionSync = new VersionSync();

// Auto-initialize
versionSync.init();

// Handle page visibility changes to sync when page becomes visible
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && navigator.onLine) {
    versionSync.syncVersion();
  }
});

// Handle beforeunload to sync final version
window.addEventListener('beforeunload', () => {
  versionSync.syncVersion();
});

export default versionSync;