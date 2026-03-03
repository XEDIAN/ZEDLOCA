/**
 * HybridLocationService - Enhanced location service with GNSS + Cellular positioning
 * Provides intelligent fallback positioning when GNSS is unavailable or inaccurate
 */

import LocationService from './LocationService.js';
import NetworkPositioningService from './NetworkPositioningService.js';

class HybridLocationService extends LocationService {
  constructor(userId, options = {}) {
    super(userId, options);
    
    // Initialize network positioning service
    this.networkService = new NetworkPositioningService();
    this.hybridEnabled = options.enableHybridPositioning !== false;
    this.cellularFallbackEnabled = options.enableCellularFallback !== false;
    this.networkMonitoringEnabled = options.enableNetworkMonitoring !== false;
    
    // Hybrid positioning state
    this.hybridState = {
      gnssAvailable: true,
      networkAvailable: false,
      positioningMethod: 'gnss_primary',
      lastNetworkCheck: 0,
      networkCheckInterval: 30000, // 30 seconds
      positioningHistory: []
    };
    
    // Performance monitoring
    this.performanceMetrics = {
      gnssAccuracy: [],
      cellularAccuracy: [],
      positioningLatency: [],
      batteryImpact: []
    };
  }

  /**
   * Initialize hybrid positioning
   */
  async initialize() {
    try {
      // Initialize network positioning service
      const networkInitialized = await this.networkService.initialize();
      this.hybridState.networkAvailable = networkInitialized;
      
      // Set up network monitoring if enabled
      if (this.networkMonitoringEnabled) {
        this.setupNetworkMonitoring();
      }
      
      console.log('Hybrid Location Service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Hybrid Location Service:', error);
      return false;
    }
  }

  /**
   * Enhanced location request with hybrid positioning
   */
  async getLocationWithFallback(options = {}) {
    // Set the start time for latency tracking BEFORE starting positioning
    this._lastPositioningStart = Date.now();
    const startTime = this._lastPositioningStart;
    
    try {
      // Try GNSS first
      const gnssResult = await this.getGNSSLocation(options);
      
      if (gnssResult.success) {
        // Check if GNSS accuracy is acceptable
        if (gnssResult.accuracy <= this.options.maxGnssAccuracy || !this.cellularFallbackEnabled) {
          this.hybridState.positioningMethod = 'gnss_primary';
          this.recordPositioningEvent('gnss_success', gnssResult);
          return gnssResult;
        }
        
        // GNSS accuracy is poor, try cellular positioning
        if (this.hybridState.networkAvailable) {
          const cellularResult = await this.getCellularLocation(options);
          
          if (cellularResult.success && cellularResult.accuracy < gnssResult.accuracy) {
            this.hybridState.positioningMethod = 'cellular_fallback';
            this.recordPositioningEvent('cellular_fallback', cellularResult);
            return cellularResult;
          }
        }
        
        // Return degraded GNSS if cellular is not better
        this.hybridState.positioningMethod = 'gnss_degraded';
        this.recordPositioningEvent('gnss_degraded', gnssResult);
        return gnssResult;
      }
      
      // GNSS failed, try cellular fallback
      if (this.cellularFallbackEnabled && this.hybridState.networkAvailable) {
        const cellularResult = await this.getCellularLocation(options);
        
        if (cellularResult.success) {
          this.hybridState.positioningMethod = 'cellular_primary';
          this.recordPositioningEvent('cellular_primary', cellularResult);
          return cellularResult;
        }
      }
      
      // All positioning methods failed
      this.hybridState.positioningMethod = 'no_positioning';
      this.recordPositioningEvent('positioning_failed', { error: 'All positioning methods failed' });
      
      return {
        success: false,
        error: 'Unable to determine location',
        positioningMethod: 'none'
      };
      
    } finally {
      const latency = Date.now() - startTime;
      this.performanceMetrics.positioningLatency.push(latency);
      
      // Keep only last 100 latency measurements
      if (this.performanceMetrics.positioningLatency.length > 100) {
        this.performanceMetrics.positioningLatency.shift();
      }
    }
  }

  /**
   * Get GNSS location with enhanced error handling
   */
  async getGNSSLocation(options = {}) {
    return new Promise((resolve) => {
      const timeout = options.timeout || this.options.timeout;
      
      const successCallback = (position) => {
        const locationData = {
          success: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
          source: 'gnss',
          positioningMethod: 'gnss',
          batteryLevel: this.batteryLevel
        };
        
        this.hybridState.gnssAvailable = true;
        this.performanceMetrics.gnssAccuracy.push(locationData.accuracy);
        resolve(locationData);
      };
      
      const errorCallback = (error) => {
        this.hybridState.gnssAvailable = false;
        resolve({
          success: false,
          error: this.getGNSSErrorMessage(error),
          source: 'gnss',
          positioningMethod: 'gnss_failed'
        });
      };
      
      navigator.geolocation.getCurrentPosition(
        successCallback,
        errorCallback,
        {
          enableHighAccuracy: this.options.enableHighAccuracy,
          timeout: timeout,
          maximumAge: this.options.maximumAge
        }
      );
    });
  }

  /**
   * Get cellular location using network positioning
   */
  async getCellularLocation(options = {}) {
    try {
      const networkResult = await this.networkService.getNetworkPosition();
      
      if (networkResult.success) {
        const locationData = {
          success: true,
          lat: networkResult.lat,
          lng: networkResult.lng,
          accuracy: networkResult.accuracy,
          timestamp: networkResult.timestamp || Date.now(),
          source: 'cellular',
          positioningMethod: 'cellular',
          networkInfo: networkResult.networkInfo,
          batteryLevel: this.batteryLevel
        };
        
        this.performanceMetrics.cellularAccuracy.push(locationData.accuracy);
        return locationData;
      }
      
      return {
        success: false,
        error: networkResult.error || 'Cellular positioning failed',
        source: 'cellular',
        positioningMethod: 'cellular_failed'
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Cellular positioning error',
        source: 'cellular',
        positioningMethod: 'cellular_error'
      };
    }
  }

  /**
   * Enhanced tracking with hybrid positioning
   */
  async startTracking() {
    // Initialize hybrid positioning
    await this.initialize();
    
    // Start standard GNSS tracking
    const trackingStarted = await super.startTracking();
    
    if (trackingStarted && this.hybridEnabled) {
      // Set up hybrid positioning monitoring
      this.setupHybridMonitoring();
    }
    
    return trackingStarted;
  }

  /**
   * Enhanced location update with hybrid positioning
   */
  async updateFirebaseLocation(position, options = {}) {
    // Add hybrid positioning metadata
    const enhancedPosition = {
      ...position,
      hybridPositioning: {
        method: this.hybridState.positioningMethod,
        gnssAvailable: this.hybridState.gnssAvailable,
        networkAvailable: this.hybridState.networkAvailable,
        positioningHistory: this.hybridState.positioningHistory.slice(-5), // Last 5 positioning events
        performanceMetrics: {
          avgGnssAccuracy: this.getAverageAccuracy(this.performanceMetrics.gnssAccuracy),
          avgCellularAccuracy: this.getAverageAccuracy(this.performanceMetrics.cellularAccuracy),
          avgLatency: this.getAverageLatency()
        }
      }
    };
    
    return super.updateFirebaseLocation(enhancedPosition, options);
  }

  /**
   * Set up network monitoring for adaptive positioning
   */
  setupNetworkMonitoring() {
    const unsubscribe = this.networkService.onNetworkChange((networkInfo) => {
      this.hybridState.networkAvailable = networkInfo.isCellular;
      this.hybridState.lastNetworkCheck = Date.now();
      
      // Log network changes
      console.log('Network change detected:', {
        type: networkInfo.type,
        effectiveType: networkInfo.effectiveType,
        cellular: networkInfo.isCellular
      });
    });
    
    // Store unsubscribe function for cleanup
    this._networkUnsubscribe = unsubscribe;
  }

  /**
   * Set up hybrid positioning monitoring
   */
  setupHybridMonitoring() {
    // Monitor positioning performance and adapt strategies
    this._monitoringInterval = setInterval(() => {
      this.evaluatePositioningStrategy();
    }, this.hybridState.networkCheckInterval);
  }

  /**
   * Evaluate and adapt positioning strategy
   */
  evaluatePositioningStrategy() {
    const now = Date.now();
    
    // Check if we should update network status
    if (now - this.hybridState.lastNetworkCheck > this.hybridState.networkCheckInterval) {
      const networkInfo = this.networkService.getNetworkInfo();
      this.hybridState.networkAvailable = networkInfo.isCellular;
      this.hybridState.lastNetworkCheck = now;
    }
    
    // Evaluate positioning performance
    const recentHistory = this.hybridState.positioningHistory.slice(-10);
    const gnssSuccessRate = this.calculateSuccessRate(recentHistory, 'gnss');
    const cellularSuccessRate = this.calculateSuccessRate(recentHistory, 'cellular');
    
    // Adapt strategy based on performance
    if (gnssSuccessRate < 0.5 && cellularSuccessRate > 0.7) {
      // Prefer cellular positioning
      this.hybridState.positioningMethod = 'cellular_preferred';
    } else if (gnssSuccessRate > 0.8) {
      // Prefer GNSS positioning
      this.hybridState.positioningMethod = 'gnss_preferred';
    }
  }

  /**
   * Calculate success rate for a positioning method
   */
  calculateSuccessRate(history, method) {
    const methodEvents = history.filter(event => event.method === method);
    if (methodEvents.length === 0) return 0;
    
    const successEvents = methodEvents.filter(event => event.success);
    return successEvents.length / methodEvents.length;
  }

  /**
   * Get average accuracy for a positioning method
   */
  getAverageAccuracy(accuracyArray) {
    if (accuracyArray.length === 0) return 0;
    return accuracyArray.reduce((sum, acc) => sum + acc, 0) / accuracyArray.length;
  }

  /**
   * Get average positioning latency
   */
  getAverageLatency() {
    if (this.performanceMetrics.positioningLatency.length === 0) return 0;
    return this.performanceMetrics.positioningLatency.reduce((sum, latency) => sum + latency, 0) / 
           this.performanceMetrics.positioningLatency.length;
  }

  /**
   * Record positioning event for performance monitoring
   */
  recordPositioningEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: Date.now(),
      method: this.hybridState.positioningMethod,
      success: data.success || false,
      accuracy: data.accuracy || null,
      latency: Date.now() - this._lastPositioningStart,
      ...data
    };
    
    this.hybridState.positioningHistory.push(event);
    
    // Keep only last 50 events
    if (this.hybridState.positioningHistory.length > 50) {
      this.hybridState.positioningHistory.shift();
    }
  }

  /**
   * Get positioning confidence level
   */
  getPositioningConfidence() {
    const networkInfo = this.networkService.getNetworkInfo();
    const confidence = this.networkService.getPositioningConfidence(networkInfo);
    
    // Enhance confidence with GNSS information
    if (this.hybridState.gnssAvailable) {
      confidence.factors.push('GNSS available');
      if (confidence.level === 'low') confidence.level = 'medium';
    }
    
    return confidence;
  }

  /**
   * Get hybrid positioning status
   */
  getHybridStatus() {
    return {
      hybridEnabled: this.hybridEnabled,
      cellularFallbackEnabled: this.cellularFallbackEnabled,
      networkMonitoringEnabled: this.networkMonitoringEnabled,
      currentMethod: this.hybridState.positioningMethod,
      gnssAvailable: this.hybridState.gnssAvailable,
      networkAvailable: this.hybridState.networkAvailable,
      positioningHistory: this.hybridState.positioningHistory.slice(-10),
      performanceMetrics: {
        avgGnssAccuracy: this.getAverageAccuracy(this.performanceMetrics.gnssAccuracy),
        avgCellularAccuracy: this.getAverageAccuracy(this.performanceMetrics.cellularAccuracy),
        avgLatency: this.getAverageLatency(),
        totalPositioningEvents: this.hybridState.positioningHistory.length
      }
    };
  }

  /**
   * Get user-friendly error message for GNSS errors
   */
  getGNSSErrorMessage(error) {
    switch (error.code) {
      case 1:
        return 'Location permission denied. Please enable location access.';
      case 2:
        return 'Location information unavailable. Check GPS and internet connection.';
      case 3:
        return 'Location request timed out. Try again in an open area.';
      default:
        return 'Location service error occurred.';
    }
  }

  /**
   * Stop tracking and cleanup
   */
  stopTracking() {
    super.stopTracking();
    
    // Cleanup monitoring intervals
    if (this._monitoringInterval) {
      clearInterval(this._monitoringInterval);
      this._monitoringInterval = null;
    }
    
    // Cleanup network monitoring
    if (this._networkUnsubscribe) {
      this._networkUnsubscribe();
      this._networkUnsubscribe = null;
    }
  }
}

export default HybridLocationService;