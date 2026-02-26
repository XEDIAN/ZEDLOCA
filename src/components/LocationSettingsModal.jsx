import React, { useState, useEffect } from 'react';
import LocationService from '../services/LocationService';
import { db, auth } from '../firebase';
import { doc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const LocationSettingsModal = ({ onClose }) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [locationService, setLocationService] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [userId, setUserId] = useState(null);

  // Subscribe to Firebase for real-time location updates
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const uid = auth.currentUser.uid;
    setUserId(uid);

    const service = new LocationService(uid);
    setLocationService(service);

    // Subscribe to user document for real-time location updates
    const unsubscribe = onSnapshot(doc(db, 'users', uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data?.location) {
          setCurrentLocation(data.location);
          setLocationEnabled(data.location.trackingEnabled || false);
        }
      }
    });

    // Check permission
    service.requestPermission().then(setPermissionStatus);

    // Get status
    const status = service.getStatus();
    setLocationEnabled(status.isTracking);

    return () => unsubscribe();
  }, []);

  const handleToggleLocation = async () => {
    if (!locationService || !userId) return;

    setLocationError('');

    if (locationEnabled) {
      // Stop tracking and update Firebase
      locationService.stopTracking();
      setLocationEnabled(false);
      
      try {
        await updateDoc(doc(db, 'users', userId), {
          'location.trackingEnabled': false
        });
      } catch (error) {
        console.error('Error updating tracking state:', error);
      }
    } else {
      // Try to get initial location before starting tracking
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

        // Update Firebase with initial location
        await updateDoc(doc(db, 'users', userId), {
          location: locationData
        });

        setCurrentLocation(locationData);
      } catch (error) {
        console.warn('Failed to get initial location:', error);
      }

      // Start tracking
      const started = await locationService.startTracking();
      setLocationEnabled(started);
      
      if (started) {
        setPermissionStatus('granted');
        try {
          await updateDoc(doc(db, 'users', userId), {
            'location.trackingEnabled': true
          });
        } catch (error) {
          console.error('Error updating tracking state:', error);
        }
      }
    }
  };

  const handleManualUpdate = async () => {
    if (!locationService || !userId) return;

    setLoading(true);
    setLocationError('');

    try {
      // Check if geolocation is available
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported on this device');
      }

      // Get position with high accuracy
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

      // Create location data object with all required fields
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
      setLoading(false);
    }
  };

  // Get accuracy quality based on GPS accuracy
  const getAccuracyQuality = (accuracy) => {
    if (accuracy <= 10) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (accuracy <= 25) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (accuracy <= 50) return { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Poor', color: 'text-red-600', bg: 'bg-red-100' };
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <span className="text-xl">✕</span>
            </button>
            <div>
              <h2 className="text-xl font-bold">Location Settings</h2>
              <p className="text-blue-100 text-sm">Manage location tracking</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Permission Status */}
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Permission: <span className={`font-semibold ${permissionStatus === 'granted' ? 'text-green-600' : permissionStatus === 'denied' ? 'text-red-600' : 'text-yellow-600'}`}>
                {permissionStatus}
              </span>
            </p>
          </div>

          {/* Toggle Automatic Updates */}
          <div className="mb-4">
            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Automatic Location Updates</span>
              <button
                onClick={handleToggleLocation}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${locationEnabled ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${locationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              {locationEnabled ? 'Location tracking is active' : 'Location tracking is disabled'}
            </p>
          </div>

          {/* Manual Update Button */}
          <div className="mb-4">
            <button
              onClick={handleManualUpdate}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Updating Location...
                </>
              ) : (
                '📍 Update My Location Now'
              )}
            </button>
          </div>

          {/* Error Message */}
          {locationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{locationError}</p>
            </div>
          )}

          {/* Current Location Display */}
          {currentLocation && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
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
              <p className="text-xs text-blue-600 mt-1">
                {currentLocation.source === 'manual_update' ? 'Updated manually' : 'Auto-updating'}
              </p>
            </div>
          )}

          {/* Back Button */}
          <div className="flex justify-center">
            <button
              onClick={onClose}
              className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg transition-colors"
            >
              <span>←</span> Back to Sidebar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationSettingsModal;
