/**
 * NetworkPositioningService - Handles cellular and network-based positioning
 * Provides fallback positioning when GNSS is unavailable or inaccurate
 */

class NetworkPositioningService {
  constructor() {
    // Network Information API support
    this.connection = navigator.connection || 
                     navigator.mozConnection || 
                     navigator.webkitConnection ||
                     navigator.msConnection;
    
    // Cellular positioning providers
    this.positioningProviders = {
      google: null,
      mozilla: null,
      custom: null
    };
    
    this.isInitialized = false;
  }

  /**
   * Initialize the network positioning service
   */
  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Check for Network Information API support
      if (!this.connection) {
        console.warn('Network Information API not supported');
        return false;
      }

      // Initialize positioning providers
      await this.initializePositioningProviders();
      
      this.isInitialized = true;
      console.log('Network Positioning Service initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize Network Positioning Service:', error);
      return false;
    }
  }

  /**
   * Initialize available positioning providers
   */
  async initializePositioningProviders() {
    // Google Network Location Provider (if available)
    if (window.google && window.google.loader) {
      this.positioningProviders.google = true;
    }

    // Mozilla Location Service (if available)
    try {
      const response = await fetch('https://location.services.mozilla.com/v1/geolocate?key=test');
      if (response.ok) {
        this.positioningProviders.mozilla = true;
      }
    } catch (error) {
      console.warn('Mozilla Location Service not available:', error);
    }

    // Custom cellular positioning (our implementation)
    this.positioningProviders.custom = true;
  }

  /**
   * Get current network information
   */
  getNetworkInfo() {
    if (!this.connection) {
      return {
        type: 'unknown',
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false,
        isCellular: false
      };
    }

    return {
      type: this.connection.type || 'unknown',
      effectiveType: this.connection.effectiveType || 'unknown',
      downlink: this.connection.downlink || 0,
      rtt: this.connection.rtt || 0,
      saveData: this.connection.saveData || false,
      isCellular: this.isCellularConnection(),
      timestamp: Date.now()
    };
  }

  /**
   * Check if current connection is cellular
   */
  isCellularConnection() {
    if (!this.connection) return false;
    
    const cellularTypes = ['cellular', '4g', '3g', '2g', 'slow-2g'];
    return cellularTypes.includes(this.connection.type) || 
           cellularTypes.includes(this.connection.effectiveType);
  }

  /**
   * Get WiFi information (if available)
   */
  getWiFiInfo() {
    // Note: Browser security restrictions limit WiFi information access
    // This would typically require native app permissions or special APIs
    return {
      available: false,
      networks: [],
      signalStrength: null,
      bssid: null
    };
  }

  /**
   * Get cellular tower information (if available)
   */
  getCellularTowerInfo() {
    // Note: Browser security restrictions limit cellular tower access
    // This would typically require native app permissions
    return {
      available: false,
      towers: [],
      cellId: null,
      locationAreaCode: null,
      mobileCountryCode: null,
      mobileNetworkCode: null
    };
  }

  /**
   * Estimate position using network information
   */
  async getNetworkPosition() {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Network positioning not available' };
      }
    }

    const networkInfo = this.getNetworkInfo();
    
    // Check if we have a cellular connection
    if (!networkInfo.isCellular) {
      return { 
        success: false, 
        error: 'No cellular connection available for positioning',
        networkInfo 
      };
    }

    // Try different positioning methods based on network quality
    let position = null;
    
    if (networkInfo.effectiveType === '4g' || networkInfo.effectiveType === '5g') {
      position = await this.getHighAccuracyNetworkPosition(networkInfo);
    } else if (networkInfo.effectiveType === '3g') {
      position = await this.getMediumAccuracyNetworkPosition(networkInfo);
    } else {
      position = await this.getLowAccuracyNetworkPosition(networkInfo);
    }

    if (position) {
      return {
        success: true,
        ...position,
        networkInfo,
        source: 'cellular_network'
      };
    }

    return { 
      success: false, 
      error: 'Unable to determine position from network',
      networkInfo 
    };
  }

  /**
   * Get high-accuracy position using 4G/5G networks
   */
  async getHighAccuracyNetworkPosition(networkInfo) {
    // Try Mozilla Location Service first (best for 4G/5G)
    if (this.positioningProviders.mozilla) {
      const position = await this.getMozillaPosition();
      if (position.success) {
        return {
          ...position,
          accuracy: this.estimateAccuracy('4g', networkInfo.downlink, networkInfo.rtt)
        };
      }
    }

    // Fallback to custom cellular positioning
    return await this.getCustomCellularPosition(networkInfo);
  }

  /**
   * Get medium-accuracy position using 3G networks
   */
  async getMediumAccuracyNetworkPosition(networkInfo) {
    return await this.getCustomCellularPosition(networkInfo);
  }

  /**
   * Get low-accuracy position using 2G/slow networks
   */
  async getLowAccuracyNetworkPosition(networkInfo) {
    // For slow networks, use city-level positioning
    return await this.getCityLevelPosition(networkInfo);
  }

  /**
   * Get position from Mozilla Location Service
   */
  async getMozillaPosition() {
    try {
      const response = await fetch('https://location.services.mozilla.com/v1/geolocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          homeMobileCountryCode: 0,
          homeMobileNetworkCode: 0,
          radioType: 'gsm',
          considerIp: true
        })
      });

      if (!response.ok) {
        throw new Error(`Mozilla service error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.location) {
        return {
          lat: data.location.lat,
          lng: data.location.lng,
          accuracy: data.accuracy || 1000,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.warn('Mozilla Location Service failed:', error);
      return null;
    }
  }

  /**
   * Custom cellular positioning algorithm
   */
  async getCustomCellularPosition(networkInfo) {
    // Use IP-based geolocation as a fallback for cellular positioning
    // This provides a reasonable estimate when GNSS is unavailable
    
    try {
      // Try IP-based geolocation first
      const response = await fetch('https://ipapi.co/json/', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.latitude && data.longitude) {
          const baseAccuracy = this.estimateAccuracy(
            networkInfo.effectiveType, 
            networkInfo.downlink, 
            networkInfo.rtt
          );
          
          return {
            lat: data.latitude,
            lng: data.longitude,
            accuracy: baseAccuracy,
            timestamp: Date.now(),
            method: 'ip_geolocation_fallback',
            networkInfo: {
              ...networkInfo,
              ipCountry: data.country_code,
              ipCity: data.city,
              ipRegion: data.region
            }
          };
        }
      }
    } catch (error) {
      console.warn('IP geolocation fallback failed:', error);
    }

    // If IP geolocation fails, return null to indicate positioning is not available
    return null;
  }

  /**
   * City-level positioning for poor network conditions
   */
  async getCityLevelPosition(networkInfo) {
    // Use IP-based geolocation as fallback
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      
      if (data.latitude && data.longitude) {
        return {
          lat: data.latitude,
          lng: data.longitude,
          accuracy: 5000, // City-level accuracy
          timestamp: Date.now(),
          method: 'ip_geolocation'
        };
      }
    } catch (error) {
      console.warn('IP geolocation failed:', error);
    }

    return null;
  }

  /**
   * Estimate positioning accuracy based on network characteristics
   */
  estimateAccuracy(networkType, downlink, rtt) {
    // Base accuracy by network type
    let baseAccuracy = 1000; // Default to 1km
    
    switch (networkType) {
      case '5g':
        baseAccuracy = 50; // 5G can provide very good accuracy
        break;
      case '4g':
        baseAccuracy = 100; // 4G provides good accuracy
        break;
      case '3g':
        baseAccuracy = 500; // 3G provides moderate accuracy
        break;
      case '2g':
        baseAccuracy = 1000; // 2G provides poor accuracy
        break;
      case 'slow-2g':
        baseAccuracy = 2000; // Very slow networks
        break;
      default:
        baseAccuracy = 1500;
    }

    // Adjust based on signal quality (if available)
    if (downlink > 0) {
      if (downlink > 10) {
        baseAccuracy *= 0.8; // Good signal
      } else if (downlink < 1) {
        baseAccuracy *= 1.5; // Poor signal
      }
    }

    if (rtt > 0) {
      if (rtt < 50) {
        baseAccuracy *= 0.9; // Low latency
      } else if (rtt > 200) {
        baseAccuracy *= 1.2; // High latency
      }
    }

    return Math.max(baseAccuracy, 20); // Minimum 20m accuracy
  }

  /**
   * Get positioning confidence level
   */
  getPositioningConfidence(networkInfo) {
    const confidence = {
      level: 'low',
      factors: [],
      recommendation: ''
    };

    if (networkInfo.isCellular) {
      switch (networkInfo.effectiveType) {
        case '5g':
          confidence.level = 'high';
          confidence.factors.push('5G network available');
          confidence.recommendation = 'Excellent positioning accuracy expected';
          break;
        case '4g':
          confidence.level = 'medium-high';
          confidence.factors.push('4G network available');
          confidence.recommendation = 'Good positioning accuracy expected';
          break;
        case '3g':
          confidence.level = 'medium';
          confidence.factors.push('3G network available');
          confidence.recommendation = 'Moderate positioning accuracy expected';
          break;
        default:
          confidence.level = 'low';
          confidence.factors.push('Slow network connection');
          confidence.recommendation = 'Poor positioning accuracy expected';
      }
    } else {
      confidence.level = 'very-low';
      confidence.factors.push('No cellular connection');
      confidence.recommendation = 'Positioning may not be available';
    }

    return confidence;
  }

  /**
   * Monitor network changes for adaptive positioning
   */
  onNetworkChange(callback) {
    if (!this.connection) return;

    const handleConnectionChange = () => {
      const networkInfo = this.getNetworkInfo();
      callback(networkInfo);
    };

    // Listen for connection changes
    if (this.connection.addEventListener) {
      this.connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      if (this.connection.removeEventListener) {
        this.connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }

  /**
   * Get service status and capabilities
   */
  getServiceStatus() {
    return {
      initialized: this.isInitialized,
      networkSupported: !!this.connection,
      cellularSupported: this.connection ? this.isCellularConnection() : false,
      providers: this.positioningProviders,
      currentNetwork: this.getNetworkInfo()
    };
  }
}

export default NetworkPositioningService;