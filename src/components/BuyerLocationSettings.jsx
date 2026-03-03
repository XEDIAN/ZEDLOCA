import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import LocationService from '../services/LocationService';
import HybridLocationService from '../services/HybridLocationService';

// Reverse geocoding function to convert coordinates to address
const reverseGeocode = async (lat, lng) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ZEDLOCA/1.0'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }
    
    const data = await response.json();
    
    if (data.display_name) {
      return data.display_name;
    }
    
    // Fallback: construct address from address components
    const addr = data.address;
    if (addr) {
      const parts = [];
      if (addr.road) parts.push(addr.road);
      if (addr.neighbourhood) parts.push(addr.neighbourhood);
      if (addr.suburb) parts.push(addr.suburb);
      if (addr.city || addr.town || addr.village) parts.push(addr.city || addr.town || addr.village);
      if (addr.state) parts.push(addr.state);
      if (addr.postcode) parts.push(addr.postcode);
      return parts.join(', ') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (error) {
    console.warn('Reverse geocoding error:', error);
    // Return coordinates as fallback
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
};

// Update undelivered orders with new buyer location
const updateUndeliveredOrdersLocation = async (userId, locationData) => {
  const undeliveredStatuses = ['pending', 'confirmed', 'preparing', 'ready'];
  
  try {
    // Query orders that are undelivered for this buyer
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(
      ordersRef,
      where('buyerId', '==', userId),
      where('status', 'in', undeliveredStatuses)
    );
    
    const ordersSnapshot = await getDocs(ordersQuery);
    
    if (ordersSnapshot.empty) {
      return { success: true, updatedCount: 0, message: 'No undelivered orders to update' };
    }
    
    // Reverse geocode the new location to get address
    const address = await reverseGeocode(locationData.lat, locationData.lng);
    
    // Update each undelivered order
    const updatePromises = ordersSnapshot.docs.map(async (orderDoc) => {
      await updateDoc(doc(db, 'orders', orderDoc.id), {
        deliveryAddress: address,
        buyerLocation: {
          lat: locationData.lat,
          lng: locationData.lng,
          accuracy: locationData.accuracy,
          timestamp: locationData.timestamp,
          updatedAt: serverTimestamp(),
          source: 'buyer_location_update'
        },
        updatedAt: serverTimestamp()
      });
    });
    
    await Promise.all(updatePromises);
    
    return { 
      success: true, 
      updatedCount: ordersSnapshot.size,
      address: address,
      message: `Updated delivery address for ${ordersSnapshot.size} order(s)`
    };
  } catch (error) {
    console.error('Error updating undelivered orders:', error);
    return { success: false, updatedCount: 0, message: error.message };
  }
};

const BuyerLocationSettings = ({ userId }) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [locationService, setLocationService] = useState(null);
  const [hybridService, setHybridService] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [hybridStatus, setHybridStatus] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState('');

  useEffect(() => {
    if (userId) {
      const service = new LocationService(userId);
      setLocationService(service);

      // Initialize hybrid positioning service
      const hybridService = new HybridLocationService(userId, {
        enableHybridPositioning: true,
        enableCellularFallback: true,
        enableNetworkMonitoring: true
      });
      setHybridService(hybridService);

      // Listen for location updates in Firebase - real-time
      const unsubscribe = onSnapshot(doc(db, 'users', userId), (doc) => {
        const data = doc.data();
        if (data?.location) {
          setCurrentLocation(data.location);
          setLocationEnabled(data.location.trackingEnabled || false);
        }
      });

      // Monitor network changes
      const monitorNetwork = async () => {
        if (hybridService) {
          try {
            await hybridService.initialize();
            
            // Get initial network info
            const networkInfo = hybridService.networkService.getNetworkInfo();
            setNetworkInfo(networkInfo);

            // Get hybrid positioning status
            const hybridStatus = hybridService.getHybridStatus();
            setHybridStatus(hybridStatus);

            // Set up network monitoring
            hybridService.networkService.onNetworkChange((networkInfo) => {
              setNetworkInfo(networkInfo);
              const status = hybridService.getHybridStatus();
              setHybridStatus(status);
            });
          } catch (error) {
            console.warn('Hybrid positioning initialization failed:', error);
          }
        }
      };

      monitorNetwork();

      return () => unsubscribe();
    }
  }, [userId]);

  const handleToggleLocation = async () => {
    if (!locationService) return;

    if (locationEnabled) {
      locationService.stopTracking();
      setIsTracking(false);
      await updateDoc(doc(db, 'users', userId), {
        'location.trackingEnabled': false
      });
    } else {
      // Force a fresh location update when enabling
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0
          });
        });

        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.coords.timestamp || Date.now(),
          updatedAt: serverTimestamp(),
          batteryLevel: 100,
          trackingEnabled: true
        };

        await updateDoc(doc(db, 'users', userId), {
          location: locationData
        });

        setCurrentLocation(locationData);
      } catch (error) {
        console.warn('Failed to get initial location:', error);
      }

      const started = await locationService.startTracking();
      setIsTracking(started);
      if (started) {
        await updateDoc(doc(db, 'users', userId), {
          'location.trackingEnabled': true
        });
      }
    }
    setLocationEnabled(!locationEnabled);
  };

  const requestPermission = async () => {
    if (locationService) {
      const status = await locationService.requestPermission();
      setPermissionStatus(status);
    }
  };

  // Mobile-optimized location update using hybrid positioning
  const handleManualLocationUpdate = async () => {
    if (!userId) return;

    setLocationLoading(true);
    setLocationError('');

    try {
      // Initialize hybrid service if not already done
      if (!hybridService) {
        const newHybridService = new HybridLocationService(userId, {
          enableHybridPositioning: true,
          enableCellularFallback: true,
          enableNetworkMonitoring: true,
          maxGnssAccuracy: 15
        });
        await newHybridService.initialize();
        setHybridService(newHybridService);
      }

      // Get position using hybrid positioning (GNSS + Cellular fallback)
      const position = await hybridService.getLocationWithFallback({
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      });

      // Check if positioning was successful
      if (!position.success) {
        throw new Error(position.error || 'Failed to get location');
      }

      // Validate coordinates
      if (!position.lat || !position.lng) {
        throw new Error('Invalid coordinates received');
      }

      // Create location data object with hybrid positioning metadata
      const locationData = {
        lat: position.lat,
        lng: position.lng,
        accuracy: position.accuracy || 0,
        timestamp: position.timestamp || Date.now(),
        updatedAt: serverTimestamp(),
        batteryLevel: 100,
        trackingEnabled: locationEnabled,
        source: position.source || 'hybrid_manual_update',
        positioningMethod: position.positioningMethod || 'hybrid',
        hybridPositioning: {
          method: hybridService.hybridState.positioningMethod,
          gnssAvailable: hybridService.hybridState.gnssAvailable,
          networkAvailable: hybridService.hybridState.networkAvailable
        }
      };

      // Update Firebase immediately - real-time sync
      await updateDoc(doc(db, 'users', userId), {
        location: locationData
      });

      // Update local state immediately for instant UI feedback
      setCurrentLocation(locationData);
      
      // Update hybrid status display
      const status = hybridService.getHybridStatus();
      setHybridStatus(status);
      
      console.log('Location updated successfully using hybrid positioning:', locationData);

      // Also update undelivered orders with the new location
      const orderUpdateResult = await updateUndeliveredOrdersLocation(userId, locationData);
      
      if (orderUpdateResult.success && orderUpdateResult.updatedCount > 0) {
        console.log('Orders updated:', orderUpdateResult.message);
        // Show success message for order updates
        setLocationSuccess(`✅ Location updated! ${orderUpdateResult.message}. New address: ${orderUpdateResult.address}`);
      } else if (orderUpdateResult.success && orderUpdateResult.updatedCount === 0) {
        console.log('No undelivered orders to update');
        setLocationSuccess('✅ Location updated successfully!');
      } else {
        console.warn('Failed to update orders:', orderUpdateResult.message);
        // Only show order update error if it wasn't the main location update that failed
        setLocationError(`⚠️ Location updated, but failed to update orders: ${orderUpdateResult.message}`);
      }
    } catch (error) {
      console.error('Location update failed:', error);
      
      let errorMessage = 'Failed to update location. ';
      
      // Handle specific geolocation errors
      if (error.code === 1) {
        errorMessage = 'Location permission denied. Please enable location access in your device settings.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS and internet connection.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again in an open outdoor area.';
      } else {
        errorMessage = error.message || 'Please try again.';
      }
      
      setLocationError(errorMessage);
    } finally {
      setLocationLoading(false);
    }
  };

  // Get accuracy quality based on GPS accuracy
  const getAccuracyQuality = (accuracy) => {
    if (accuracy <= 10) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (accuracy <= 25) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (accuracy <= 50) return { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Poor', color: 'text-red-600', bg: 'bg-red-100' };
  };

  // Check if accuracy is problematic
  const isAccuracyPoor = currentLocation?.accuracy > 50;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">📍 Location Tracking</h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Automatic Location Updates</p>
            <p className="text-sm text-gray-600">
              Allow sellers to track your location for accurate delivery
            </p>
          </div>
          <button
            onClick={handleToggleLocation}
            className={`px-4 py-2 rounded-lg font-medium ${
              locationEnabled
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {locationEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {permissionStatus !== 'granted' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
            <p className="text-sm text-yellow-800">
              Location permission required for automatic updates.
            </p>
            <button
              onClick={requestPermission}
              className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
            >
              Grant Permission
            </button>
          </div>
        )}

        {currentLocation && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm font-medium text-blue-800">Current Location:</p>
            <p className="text-xs text-blue-600 mt-1">
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </p>
            <div className="flex items-center mt-2">
              <p className="text-xs text-blue-600">
                Accuracy: ±{Math.round(currentLocation.accuracy)}m
              </p>
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getAccuracyQuality(currentLocation.accuracy).bg} ${getAccuracyQuality(currentLocation.accuracy).color}`}>
                {getAccuracyQuality(currentLocation.accuracy).label}
              </span>
            </div>
            <p className="text-xs text-blue-600">
              Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Success Message */}
        {locationSuccess && (
          <div className="bg-green-50 border border-green-200 rounded p-3">
            <p className="text-sm text-green-800">{locationSuccess}</p>
          </div>
        )}

        {/* Error Message */}
        {locationError && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">{locationError}</p>
          </div>
        )}

        {/* Manual Location Update Button */}
        <button
          onClick={handleManualLocationUpdate}
          disabled={locationLoading}
          className="w-full mt-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center"
        >
          {locationLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Updating Location...
            </>
          ) : (
            '📍 Update My Location Now'
          )}
        </button>

        {/* Accuracy Warning */}
        {isAccuracyPoor && (
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm font-medium text-red-800">⚠️ Low Location Accuracy</p>
            <p className="text-xs text-red-600 mt-1">
              Your current location accuracy is poor (±{Math.round(currentLocation?.accuracy)}m). 
              This may affect delivery accuracy. Try updating your location outdoors or enable 
              high-accuracy location mode in your device settings.
            </p>
          </div>
        )}

        {/* Network Information */}
        {networkInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded p-3">
            <h4 className="font-medium text-sm mb-2">📡 Network Positioning</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Network Type:</span>
                <span className="ml-2 font-medium">{networkInfo.type}</span>
              </div>
              <div>
                <span className="text-gray-600">Signal Quality:</span>
                <span className={`ml-2 px-1 py-0.5 rounded text-xs ${
                  networkInfo.effectiveType === '5g' ? 'bg-green-100 text-green-700' :
                  networkInfo.effectiveType === '4g' ? 'bg-blue-100 text-blue-700' :
                  networkInfo.effectiveType === '3g' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {networkInfo.effectiveType.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Download Speed:</span>
                <span className="ml-2 font-medium">{networkInfo.downlink || 'Unknown'} Mbps</span>
              </div>
              <div>
                <span className="text-gray-600">Latency:</span>
                <span className="ml-2 font-medium">{networkInfo.rtt || 'Unknown'} ms</span>
              </div>
            </div>
          </div>
        )}

        {/* Hybrid Positioning Status */}
        {hybridStatus && (
          <div className="bg-purple-50 border border-purple-200 rounded p-3">
            <h4 className="font-medium text-sm mb-2">🔀 Hybrid Positioning</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-600">Current Method:</span>
                <span className={`ml-2 px-1 py-0.5 rounded text-xs ${
                  hybridStatus.currentMethod === 'gnss_primary' ? 'bg-green-100 text-green-700' :
                  hybridStatus.currentMethod === 'cellular_fallback' ? 'bg-blue-100 text-blue-700' :
                  hybridStatus.currentMethod === 'cellular_primary' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {hybridStatus.currentMethod.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-gray-600">GNSS Available:</span>
                <span className={`ml-2 font-medium ${
                  hybridStatus.gnssAvailable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {hybridStatus.gnssAvailable ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Network Available:</span>
                <span className={`ml-2 font-medium ${
                  hybridStatus.networkAvailable ? 'text-green-600' : 'text-red-600'
                }`}>
                  {hybridStatus.networkAvailable ? 'Yes' : 'No'}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Hybrid Enabled:</span>
                <span className={`ml-2 font-medium ${
                  hybridStatus.hybridEnabled ? 'text-green-600' : 'text-red-600'
                }`}>
                  {hybridStatus.hybridEnabled ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>• Location updates every 5 minutes or 100m movement</p>
          <p>• Tracking stops automatically below 20% battery</p>
          <p>• Hybrid positioning provides fallback when GPS is unavailable</p>
          <p>• Network-based positioning works indoors and in urban areas</p>
        </div>
      </div>
    </div>
  );
};

export default BuyerLocationSettings;
