import { db } from '../firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import versionSync from './versionSync';
import conflictResolver from './conflictResolver';

class CrossDeviceTest {
  constructor() {
    this.testResults = [];
    this.testId = `test_${Date.now()}`;
    this.deviceId = `device_${Math.random().toString(36).substr(2, 9)}`;
    this.testRef = doc(db, 'cross_device_tests', this.testId);
    this.unsubscribe = null;
  }

  // Initialize cross-device test
  async init() {
    console.log(`Cross-device test initialized for ${this.deviceId}`);
    
    // Set up real-time listener for test updates
    this.setupTestListener();
    
    // Start periodic test data updates
    this.startPeriodicUpdates();
    
    // Listen for version sync events
    versionSync.addListener(this.handleVersionEvent.bind(this));
    
    // Initial test data
    await this.updateTestData({
      deviceId: this.deviceId,
      timestamp: Date.now(),
      status: 'active',
      version: versionSync.getCurrentVersion()
    });
  }

  // Set up real-time listener for test updates
  setupTestListener() {
    this.unsubscribe = onSnapshot(this.testRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        console.log('Test data updated from another device:', data);
        
        // Log cross-device synchronization
        this.logTestResult({
          type: 'cross_device_sync',
          timestamp: Date.now(),
          data: data,
          deviceId: this.deviceId
        });
      }
    }, (error) => {
      console.error('Test listener error:', error);
    });
  }

  // Start periodic test data updates
  startPeriodicUpdates() {
    this.updateInterval = setInterval(async () => {
      try {
        await this.updateTestData({
          deviceId: this.deviceId,
          timestamp: Date.now(),
          status: 'active',
          version: versionSync.getCurrentVersion(),
          randomValue: Math.random(),
          testCounter: (await this.getCurrentTestCounter()) + 1
        });
      } catch (error) {
        console.error('Periodic update failed:', error);
      }
    }, 10000); // Update every 10 seconds
  }

  // Update test data
  async updateTestData(data) {
    try {
      await setDoc(this.testRef, {
        ...data,
        lastUpdated: serverTimestamp(),
        deviceId: this.deviceId
      }, { merge: true });
      
      this.logTestResult({
        type: 'local_update',
        timestamp: Date.now(),
        data: data,
        deviceId: this.deviceId
      });
      
    } catch (error) {
      console.error('Test data update failed:', error);
      this.logTestResult({
        type: 'update_error',
        timestamp: Date.now(),
        error: error.message,
        deviceId: this.deviceId
      });
    }
  }

  // Get current test counter
  async getCurrentTestCounter() {
    try {
      const docSnap = await this.testRef.get();
      return docSnap.exists() ? (docSnap.data().testCounter || 0) : 0;
    } catch (error) {
      return 0;
    }
  }

  // Handle version sync events
  handleVersionEvent(event, data) {
    this.logTestResult({
      type: 'version_event',
      timestamp: Date.now(),
      event: event,
      data: data,
      deviceId: this.deviceId
    });
  }

  // Log test results
  logTestResult(result) {
    this.testResults.push(result);
    console.log('Test result logged:', result);
    
    // Keep only last 100 results
    if (this.testResults.length > 100) {
      this.testResults = this.testResults.slice(-50);
    }
  }

  // Test offline/online scenarios
  async testOfflineScenario() {
    console.log('Testing offline scenario...');
    
    // Simulate going offline
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    
    try {
      // Try to update data while offline
      await this.updateTestData({
        deviceId: this.deviceId,
        timestamp: Date.now(),
        status: 'offline',
        offlineTest: true
      });
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate going back online
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      
      // Test conflict resolution
      await conflictResolver.syncPendingOperations();
      
      this.logTestResult({
        type: 'offline_test',
        timestamp: Date.now(),
        status: 'completed',
        deviceId: this.deviceId
      });
      
    } catch (error) {
      console.error('Offline test failed:', error);
      this.logTestResult({
        type: 'offline_test_error',
        timestamp: Date.now(),
        error: error.message,
        deviceId: this.deviceId
      });
    }
  }

  // Test version synchronization
  async testVersionSync() {
    console.log('Testing version synchronization...');
    
    try {
      // Force version update
      await versionSync.forceUpdate();
      
      // Wait for sync
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      this.logTestResult({
        type: 'version_sync_test',
        timestamp: Date.now(),
        status: 'completed',
        deviceId: this.deviceId,
        version: versionSync.getCurrentVersion()
      });
      
    } catch (error) {
      console.error('Version sync test failed:', error);
      this.logTestResult({
        type: 'version_sync_error',
        timestamp: Date.now(),
        error: error.message,
        deviceId: this.deviceId
      });
    }
  }

  // Test conflict resolution
  async testConflictResolution() {
    console.log('Testing conflict resolution...');
    
    try {
      // Create conflicting data
      const conflictData = {
        deviceId: this.deviceId,
        timestamp: Date.now(),
        status: 'conflict_test',
        testData: Math.random().toString(36).substr(2, 9)
      };
      
      // Update with conflict data
      await this.updateTestData(conflictData);
      
      // Wait for potential conflicts
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      this.logTestResult({
        type: 'conflict_resolution_test',
        timestamp: Date.now(),
        status: 'completed',
        deviceId: this.deviceId
      });
      
    } catch (error) {
      console.error('Conflict resolution test failed:', error);
      this.logTestResult({
        type: 'conflict_resolution_error',
        timestamp: Date.now(),
        error: error.message,
        deviceId: this.deviceId
      });
    }
  }

  // Get test summary
  getTestSummary() {
    const summary = {
      testId: this.testId,
      deviceId: this.deviceId,
      totalResults: this.testResults.length,
      resultsByType: {},
      lastUpdated: Date.now(),
      version: versionSync.getCurrentVersion(),
      isOnline: navigator.onLine
    };
    
    // Count results by type
    this.testResults.forEach(result => {
      summary.resultsByType[result.type] = (summary.resultsByType[result.type] || 0) + 1;
    });
    
    return summary;
  }

  // Export test results
  exportResults() {
    const summary = this.getTestSummary();
    const exportData = {
      summary: summary,
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
    
    // Create download link
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cross_device_test_${this.testId}_${this.deviceId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return exportData;
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Remove version sync listener
    versionSync.removeListener(this.handleVersionEvent.bind(this));
    
    console.log(`Cross-device test destroyed for ${this.deviceId}`);
  }
}

// Create singleton instance
const crossDeviceTest = new CrossDeviceTest();

// Auto-initialize if in development mode
if (process.env.NODE_ENV === 'development') {
  crossDeviceTest.init().catch(console.error);
}

export default crossDeviceTest;