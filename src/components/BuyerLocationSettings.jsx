import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import LocationService from '../services/LocationService';

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
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState('');

  useEffect(() => {
    if (userId) {
      const service = new LocationService(userId);
      setLocationService(service);

      // Listen for location updates in Firebase - real-time
      const unsubscribe = onSnapshot(doc(db, 'users', userId), (doc) => {
        const data = doc.data();
        if (data?.location) {
          setCurrentLocation(data.location);
          setLocationEnabled(data.location.trackingEnabled || false);
        }
      });

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

  // Mobile-optimized location update - no delays or errors
  const handleManualLocationUpdate = async () => {
    if (!userId) return;

    setLocationLoading(true);
    setLocationError('');

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported on this device');
      }

      // Get position with high accuracy for mobile
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        });
      });

      // Validate coordinates
      if (!position.coords.latitude || !position.coords.longitude) {
        throw new Error('Invalid GPS coordinates received');
      }

      // Create location data object
      const locationData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        timestamp: position.timestamp || Date.now(),
        updatedAt: serverTimestamp(),
        batteryLevel: 100,
        trackingEnabled: locationEnabled,
        source: 'manual_update'
      };

      // Update Firebase immediately - real-time sync
      await updateDoc(doc(db, 'users', userId), {
        location: locationData
      });

      // Update local state immediately for instant UI feedback
      setCurrentLocation(locationData);
      
      console.log('Location updated successfully:', locationData);

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

        <div className="text-xs text-gray-500">
          <p>• Location updates every 5 minutes or 100m movement</p>
          <p>• Tracking stops automatically below 20% battery</p>
          <p>• You can disable tracking anytime</p>
        </div>
      </div>
    </div>
  );
};

export default BuyerLocationSettings;
