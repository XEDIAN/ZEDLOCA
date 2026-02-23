import { useState, useEffect } from 'react';

/**
 * UI Consistency Manager
 * Ensures consistent UI experience across different devices and screen sizes
 */
class UIConsistencyManager {
  constructor() {
    this.isMobile = false;
    this.deviceType = 'desktop';
    this.orientation = 'portrait';
    this.listeners = new Set();
  }

  // Initialize UI consistency checks
  init() {
    this.updateDeviceState();
    this.setupEventListeners();
  }

  // Update device state based on current viewport
  updateDeviceState() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Determine device type
    if (width <= 640) {
      this.isMobile = true;
      this.deviceType = 'mobile';
    } else if (width <= 1024) {
      this.isMobile = true;
      this.deviceType = 'tablet';
    } else {
      this.isMobile = false;
      this.deviceType = 'desktop';
    }
    
    // Determine orientation
    this.orientation = width > height ? 'landscape' : 'portrait';
    
    // Notify listeners
    this.notifyListeners();
  }

  // Set up event listeners for responsive behavior
  setupEventListeners() {
    // Debounced resize handler
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.updateDeviceState();
      }, 100);
    };

    // Orientation change handler
    const handleOrientationChange = () => {
      setTimeout(() => {
        this.updateDeviceState();
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }

  // Add listener for device state changes
  addListener(callback) {
    this.listeners.add(callback);
  }

  // Remove listener
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  // Notify all listeners of state changes
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          isMobile: this.isMobile,
          deviceType: this.deviceType,
          orientation: this.orientation
        });
      } catch (error) {
        console.error('UI consistency listener error:', error);
      }
    });
  }

  // Get current device state
  getDeviceState() {
    return {
      isMobile: this.isMobile,
      deviceType: this.deviceType,
      orientation: this.orientation
    };
  }

  // Get appropriate CSS classes for responsive design
  getResponsiveClasses(baseClasses = '') {
    const state = this.getDeviceState();
    const classes = [baseClasses];
    
    if (state.isMobile) {
      classes.push('mobile-view');
      if (state.orientation === 'landscape') {
        classes.push('mobile-landscape');
      } else {
        classes.push('mobile-portrait');
      }
    } else {
      classes.push('desktop-view');
    }
    
    return classes.join(' ');
  }

  // Check if current device supports touch
  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  // Get optimal font size for current device
  getOptimalFontSize(baseSize = 16) {
    const state = this.getDeviceState();
    if (state.deviceType === 'mobile') {
      return baseSize * 1.1; // Slightly larger text for mobile
    }
    return baseSize;
  }

  // Get optimal button size for current device
  getOptimalButtonSize() {
    const state = this.getDeviceState();
    if (state.deviceType === 'mobile') {
      return {
        padding: '12px 16px',
        fontSize: '16px',
        minWidth: '44px',
        minHeight: '44px'
      };
    }
    return {
      padding: '8px 12px',
      fontSize: '14px',
      minWidth: 'auto',
      minHeight: 'auto'
    };
  }
}

// Create singleton instance
const uiConsistency = new UIConsistencyManager();

// React hook for using UI consistency in components
export const useUIConsistency = () => {
  const [deviceState, setDeviceState] = useState(() => uiConsistency.getDeviceState());

  useEffect(() => {
    const updateState = (state) => setDeviceState(state);
    uiConsistency.addListener(updateState);
    
    // Initial update
    uiConsistency.updateDeviceState();
    
    return () => uiConsistency.removeListener(updateState);
  }, []);

  return {
    ...deviceState,
    getResponsiveClasses: uiConsistency.getResponsiveClasses.bind(uiConsistency),
    isTouchDevice: uiConsistency.isTouchDevice.bind(uiConsistency),
    getOptimalFontSize: uiConsistency.getOptimalFontSize.bind(uiConsistency),
    getOptimalButtonSize: uiConsistency.getOptimalButtonSize.bind(uiConsistency)
  };
};

// Initialize on module load
uiConsistency.init();

export default uiConsistency;