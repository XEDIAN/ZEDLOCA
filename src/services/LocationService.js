class LocationService {
  constructor(userId, options = {}) {
    this.userId = userId;
    this.options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 120000, // 2 minutes
      updateInterval: 120000, // 2 minutes
      minDistance: 5, // 5 meters
      batteryThreshold: 20, // Stop tracking below 20%
      ...options
    };

    this.watchId = null;
    this.lastPosition = null;
    this.lastUpdate = 0;
    this.isTracking = false;
    this.batteryLevel = 100;
  }

  async requestPermission() {
    if (!navigator.permissions) {
      return 'prompt'; // Fallback for older browsers
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state;
    } catch (error) {
      console.warn('Permission query failed:', error);
      return 'prompt';
    }
  }

  calculateDistance(pos1, pos2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = pos1.lat * Math.PI / 180;
    const φ2 = pos2.lat * Math.PI / 180;
    const Δφ = (pos2.lat - pos1.lat) * Math.PI / 180;
    const Δλ = (pos2.lng - pos1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  shouldUpdateLocation(newPosition) {
    const now = Date.now();
    const timeSinceLastUpdate = now - this.lastUpdate;

    // Always update if it's been too long
    if (timeSinceLastUpdate > this.options.updateInterval) {
      return true;
    }

    // Check distance threshold
    if (this.lastPosition) {
      const distance = this.calculateDistance(this.lastPosition, newPosition);
      if (distance > this.options.minDistance) {
        return true;
      }
    }

    // Check accuracy improvement: update if accuracy <= 12m and 5% more accurate
    if (this.lastPosition && newPosition.accuracy <= 12 && newPosition.accuracy < this.lastPosition.accuracy * 0.95) {
      return true;
    }

    // For poor accuracy (>12m), update if moved at least 5m regardless of accuracy improvement
    if (this.lastPosition && newPosition.accuracy > 12) {
      const distance = this.calculateDistance(this.lastPosition, newPosition);
      if (distance >= 5) {
        return true;
      }
    }

    return false;
  }

  async updateFirebaseLocation(position, options = {}) {
    try {
      const { db } = await import('../firebase');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');

      const locationData = {
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy,
        timestamp: position.timestamp || Date.now(),
        updatedAt: serverTimestamp(),
        batteryLevel: this.batteryLevel,
        trackingEnabled: options.trackingEnabled !== undefined ? options.trackingEnabled : true,
        source: options.source || 'automatic_tracking'
      };

      await updateDoc(
        doc(db, 'users', this.userId),
        { location: locationData }
      );

      console.log('Location updated in Firebase:', locationData);
      return true;
    } catch (error) {
      console.error('Failed to update location in Firebase:', error);
      return false;
    }
  }

  async startTracking() {
    const permission = await this.requestPermission();

    if (permission !== 'granted') {
      console.log('Location permission not granted:', permission);
      this.isTracking = false;
      return false;
    }

    // Check battery level (if available)
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        this.batteryLevel = battery.level * 100;
        if (this.batteryLevel < this.options.batteryThreshold) {
          console.log('Battery too low for location tracking:', this.batteryLevel + '%');
          this.isTracking = false;
          return false;
        }
      } catch (error) {
        console.warn('Battery API not available:', error);
      }
    }

    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const newPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };

        if (this.shouldUpdateLocation(newPosition)) {
          const success = await this.updateFirebaseLocation(newPosition);
          if (success) {
            this.lastPosition = newPosition;
            this.lastUpdate = Date.now();
          }
        }
      },
      (error) => {
        console.error('Location tracking error:', error);
        this.handleTrackingError(error);
      },
      {
        enableHighAccuracy: this.options.enableHighAccuracy,
        timeout: this.options.timeout,
        maximumAge: this.options.maximumAge
      }
    );

    this.isTracking = true;
    console.log('Location tracking started with watchId:', this.watchId);
    return true;
  }

  stopTracking() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    console.log('Location tracking stopped');
  }

  handleTrackingError(error) {
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        console.error('Location access denied by user');
        this.stopTracking();
        break;
      case 2: // POSITION_UNAVAILABLE
        console.error('Location information unavailable');
        // Could retry with different options
        break;
      case 3: // TIMEOUT
        console.error('Location request timed out');
        // Could retry with longer timeout
        break;
      default:
        console.error('Unknown location error:', error);
    }
  }

  getStatus() {
    return {
      isTracking: this.isTracking,
      lastUpdate: this.lastUpdate,
      lastPosition: this.lastPosition,
      batteryLevel: this.batteryLevel,
      watchId: this.watchId
    };
  }
}

export default LocationService;
