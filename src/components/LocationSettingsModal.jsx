import React, { useState, useEffect } from 'react';
import LocationService from '../services/LocationService';
import { auth } from '../firebase';

const LocationSettingsModal = ({ onClose }) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [loading, setLoading] = useState(false);
  const [locationService, setLocationService] = useState(null);

  useEffect(() => {
    if (auth.currentUser) {
      const service = new LocationService(auth.currentUser.uid);
      setLocationService(service);

      // Check permission
      service.requestPermission().then(setPermissionStatus);

      // Get status
      const status = service.getStatus();
      setLocationEnabled(status.isTracking);
      if (status.lastPosition) {
        setCurrentLocation(status.lastPosition);
      }
    }
  }, []);

  const handleToggleLocation = async () => {
    if (!locationService) return;

    if (locationEnabled) {
      locationService.stopTracking();
      setLocationEnabled(false);
    } else {
      const success = await locationService.startTracking();
      setLocationEnabled(success);
      if (success) {
        setPermissionStatus('granted');
      }
    }
  };

  const handleManualUpdate = async () => {
    if (!locationService) return;

    setLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000
        });
      });
      const newPos = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      await locationService.updateFirebaseLocation(newPos);
      setCurrentLocation(newPos);
    } catch (error) {
      console.error('Manual location update failed:', error);
    }
    setLoading(false);
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Location Manually'}
            </button>
          </div>

          {/* Current Location Display */}
          {currentLocation && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Current Location:</p>
              <p className="text-xs text-gray-600">
                Lat: {currentLocation.lat.toFixed(6)}, Lng: {currentLocation.lng.toFixed(6)}
              </p>
              <p className="text-xs text-gray-600">
                Accuracy: {currentLocation.accuracy.toFixed(1)}m
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
