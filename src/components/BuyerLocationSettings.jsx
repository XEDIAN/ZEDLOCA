import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import LocationService from '../services/LocationService';

const BuyerLocationSettings = ({ userId }) => {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('unknown');
  const [locationService, setLocationService] = useState(null);

  useEffect(() => {
    if (userId) {
      const service = new LocationService(userId);
      setLocationService(service);

      // Listen for location updates in Firebase
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
            <p className="text-xs text-blue-600">
              Accuracy: ±{Math.round(currentLocation.accuracy)}m
            </p>
            <p className="text-xs text-blue-600">
              Last updated: {new Date(currentLocation.timestamp).toLocaleTimeString()}
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
