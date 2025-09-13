import React, { useState } from 'react';
import { useMap } from 'react-leaflet';

function MapControls() {
  const map = useMap();
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState(null);

  const handleZoomIn = () => {
    map.zoomIn();
    // Add haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleZoomOut = () => {
    map.zoomOut();
    // Add haptic feedback for mobile devices
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000 // Cache location for 1 minute
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        map.flyTo([latitude, longitude], 15, {
          animate: true,
          duration: 1.5
        });
        setIsLocating(false);
        
        // Add haptic feedback for successful location
        if (navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      },
      (error) => {
        setIsLocating(false);
        let errorMessage = 'Unable to get your location';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
          default:
            errorMessage = 'An unknown error occurred while getting location.';
            break;
        }
        
        setLocationError(errorMessage);
        
        // Clear error after 5 seconds
        setTimeout(() => setLocationError(null), 5000);
      },
      options
    );
  };

  return (
    <>
      {/* Map Controls Container */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col gap-2 md:bottom-4">
        {/* Zoom Controls */}
        <div className="flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="w-12 h-12 md:w-10 md:h-10 bg-white hover:bg-gray-100 active:bg-gray-200 
                     flex items-center justify-center text-gray-700 font-bold text-xl
                     transition-colors duration-150 border-b border-gray-200 last:border-b-0
                     touch-manipulation select-none"
            aria-label="Zoom in"
            type="button"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            className="w-12 h-12 md:w-10 md:h-10 bg-white hover:bg-gray-100 active:bg-gray-200 
                     flex items-center justify-center text-gray-700 font-bold text-xl
                     transition-colors duration-150
                     touch-manipulation select-none"
            aria-label="Zoom out"
            type="button"
          >
            −
          </button>
        </div>

        {/* Location Control */}
        <button
          onClick={handleLocateMe}
          disabled={isLocating}
          className={`w-12 h-12 md:w-10 md:h-10 bg-white hover:bg-gray-100 active:bg-gray-200 
                     rounded-lg shadow-lg flex items-center justify-center text-gray-700
                     transition-colors duration-150 touch-manipulation select-none
                     ${isLocating ? 'opacity-75 cursor-not-allowed' : 'cursor-pointer'}
                     ${locationError ? 'bg-red-50 text-red-600' : ''}`}
          aria-label="Find my location"
          type="button"
        >
          {isLocating ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle 
                className="opacity-25" 
                cx="12" 
                cy="12" 
                r="10" 
                stroke="currentColor" 
                strokeWidth="4"
              />
              <path 
                className="opacity-75" 
                fill="currentColor" 
                d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" 
              />
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" 
              />
            </svg>
          )}
        </button>
      </div>

      {/* Error Toast */}
      {locationError && (
        <div className="fixed top-24 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg shadow-lg">
            <div className="flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path 
                  fillRule="evenodd" 
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" 
                  clipRule="evenodd" 
                />
              </svg>
              <span className="text-sm">{locationError}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MapControls;