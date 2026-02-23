import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

class ConflictResolver {
  constructor() {
    this.conflictThreshold = 5000; // 5 seconds
    this.pendingOperations = new Map();
  }

  // Resolve conflicts using timestamp-based strategy
  async resolveConflict(collection, docId, localData, remoteData) {
    const conflictKey = `${collection}/${docId}`;
    
    try {
      // Get current server state
      const docRef = doc(db, collection, docId);
      const currentDoc = await getDoc(docRef);
      const serverData = currentDoc.exists() ? currentDoc.data() : {};
      
      // Determine which data is newer
      const localTimestamp = localData._timestamp || Date.now();
      const remoteTimestamp = remoteData._timestamp || Date.now();
      const serverTimestamp = serverData._timestamp || Date.now();
      
      // Use the most recent data
      let resolvedData;
      if (localTimestamp >= remoteTimestamp && localTimestamp >= serverTimestamp) {
        resolvedData = { ...localData, _timestamp: Date.now() };
      } else if (remoteTimestamp >= serverTimestamp) {
        resolvedData = { ...remoteData, _timestamp: Date.now() };
      } else {
        resolvedData = { ...serverData, _timestamp: Date.now() };
      }
      
      // Merge critical fields that shouldn't be lost
      resolvedData = this.mergeCriticalFields(localData, remoteData, resolvedData);
      
      // Apply resolved data
      await setDoc(docRef, resolvedData, { merge: true });
      
      console.log('Conflict resolved for', conflictKey, resolvedData);
      
      return resolvedData;
      
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      throw error;
    }
  }

  // Merge critical fields that should be preserved
  mergeCriticalFields(localData, remoteData, resolvedData) {
    const merged = { ...resolvedData };
    
    // Preserve user preferences and settings
    if (localData.userPreferences) {
      merged.userPreferences = { ...merged.userPreferences, ...localData.userPreferences };
    }
    
    // Preserve cart items
    if (localData.cartItems) {
      merged.cartItems = [...(merged.cartItems || []), ...(localData.cartItems || [])];
    }
    
    // Preserve notification settings
    if (localData.notifications) {
      merged.notifications = { ...merged.notifications, ...localData.notifications };
    }
    
    return merged;
  }

  // Handle offline-first operations with conflict detection
  async handleOfflineOperation(operation, data) {
    const operationKey = `${operation}_${Date.now()}`;
    
    try {
      // Store operation locally
      this.pendingOperations.set(operationKey, {
        operation,
        data,
        timestamp: Date.now(),
        status: 'pending'
      });
      
      // Try to sync immediately if online
      if (navigator.onLine) {
        await this.syncPendingOperations();
      }
      
      return { success: true, operationKey };
      
    } catch (error) {
      console.error('Offline operation failed:', error);
      return { success: false, error };
    }
  }

  // Sync all pending operations
  async syncPendingOperations() {
    if (!navigator.onLine) return;
    
    const operations = Array.from(this.pendingOperations.values());
    
    for (const operation of operations) {
      try {
        await this.executeOperation(operation);
        this.pendingOperations.delete(operation.operationKey);
      } catch (error) {
        console.error('Operation sync failed:', error);
      }
    }
  }

  // Execute a single operation
  async executeOperation(operation) {
    const { operation: opType, data } = operation;
    
    switch (opType) {
      case 'update_user':
        await this.syncUserData(data);
        break;
      case 'update_location':
        await this.syncLocationData(data);
        break;
      case 'update_cart':
        await this.syncCartData(data);
        break;
      default:
        throw new Error(`Unknown operation: ${opType}`);
    }
  }

  // Sync user data with conflict resolution
  async syncUserData(userData) {
    const userRef = doc(db, 'users', userData.uid);
    const currentDoc = await getDoc(userRef);
    const currentData = currentDoc.exists() ? currentDoc.data() : {};
    
    // Check for conflicts
    if (this.hasConflicts(currentData, userData)) {
      await this.resolveConflict('users', userData.uid, userData, currentData);
    } else {
      await setDoc(userRef, { ...userData, _timestamp: Date.now() }, { merge: true });
    }
  }

  // Sync location data with conflict resolution
  async syncLocationData(locationData) {
    const collection = locationData.type === 'seller' ? 'sellers' : 'buyers';
    const userRef = doc(db, collection, locationData.uid);
    const currentDoc = await getDoc(userRef);
    const currentData = currentDoc.exists() ? currentDoc.data() : {};
    
    // Check for conflicts
    if (this.hasConflicts(currentData, locationData)) {
      await this.resolveConflict(collection, locationData.uid, locationData, currentData);
    } else {
      await setDoc(userRef, { ...locationData, _timestamp: Date.now() }, { merge: true });
    }
  }

  // Sync cart data with conflict resolution
  async syncCartData(cartData) {
    const cartRef = doc(db, 'carts', cartData.userId);
    const currentDoc = await getDoc(cartRef);
    const currentData = currentDoc.exists() ? currentDoc.data() : {};
    
    // Merge cart items
    const mergedItems = this.mergeCartItems(currentData.items || [], cartData.items || []);
    
    await setDoc(cartRef, {
      items: mergedItems,
      _timestamp: Date.now()
    }, { merge: true });
  }

  // Merge cart items without duplicates
  mergeCartItems(currentItems, newItems) {
    const merged = [...currentItems];
    
    for (const newItem of newItems) {
      const existingIndex = merged.findIndex(item => item.productId === newItem.productId);
      
      if (existingIndex >= 0) {
        // Update quantity if item already exists
        merged[existingIndex].quantity += newItem.quantity;
      } else {
        // Add new item
        merged.push(newItem);
      }
    }
    
    return merged;
  }

  // Check if there are conflicts between data sets
  hasConflicts(currentData, newData) {
    const currentTimestamp = currentData._timestamp || 0;
    const newTimestamp = newData._timestamp || 0;
    
    // Consider it a conflict if timestamps are close (within threshold)
    return Math.abs(currentTimestamp - newTimestamp) < this.conflictThreshold;
  }

  // Get all pending operations
  getPendingOperations() {
    return Array.from(this.pendingOperations.values());
  }

  // Clear all pending operations
  clearPendingOperations() {
    this.pendingOperations.clear();
  }
}

// Create singleton instance
const conflictResolver = new ConflictResolver();

export default conflictResolver;