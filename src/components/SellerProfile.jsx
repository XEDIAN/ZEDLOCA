import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';
import { getSellerProfileUrl } from '../utils/linkUtils';

const SellerProfile = ({ sellerId, onBack }) => {
  const { formatPrice } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState({
    storeName: '',
    displayName: '',
    email: '',
    phone: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    website: '',
    categories: [],
    paymentMethods: ['cash'],
    deliveryOptions: ['pickup'],
    location: null,
    photoURL: '',
    coverPhotoURL: ''
  });

  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    loadSellerProfile();
  }, [sellerId]);

  const loadSellerProfile = async () => {
    try {
      setLoading(true);
      const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
      if (sellerDoc.exists()) {
        const data = sellerDoc.data();
        setProfile(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (error) {
      console.error('Error loading seller profile:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      await updateDoc(doc(db, 'sellers', sellerId), {
        ...profile,
        updatedAt: serverTimestamp()
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile changes');
    } finally {
      setSaving(false);
    }
  };

  const handleLocationUpdate = async () => {
    setLocationLoading(true);
    setLocationError('');

    // Check if geolocation is available
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported on this device. Please use a modern browser.');
      setLocationLoading(false);
      return;
    }

    try {
      // Check permission status first
      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          if (permissionStatus.state === 'denied') {
            setLocationError('Location permission denied. Please enable location access in your device settings and refresh.');
            setLocationLoading(false);
            return;
          }
        } catch (e) {
          console.log('Permissions API not supported');
        }
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 60000, // Increased timeout for mobile devices
          maximumAge: 0
        });
      });

      // Validate coordinates
      if (!position.coords || typeof position.coords.latitude !== 'number' || typeof position.coords.longitude !== 'number') {
        throw new Error('Invalid GPS coordinates received');
      }

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        timestamp: new Date().toISOString(),
        updatedAt: serverTimestamp()
      };

      // Save to sellers collection - update both nested location object and flat lat/lng fields
      // Flat fields are needed for map components and distance calculations
      await updateDoc(doc(db, 'sellers', sellerId), {
        location: location,
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        updatedAt: serverTimestamp()
      });

      // Also save to users collection for real-time profile updates
      await updateDoc(doc(db, 'users', sellerId), {
        location: location
      });

      // Update all the seller's listings with the new location
      try {
        const listingsQuery = query(
          collection(db, 'listings'),
          where('userId', '==', sellerId)
        );
        const listingsSnapshot = await getDocs(listingsQuery);
        
        if (!listingsSnapshot.empty) {
          const updatePromises = listingsSnapshot.docs.map(listingDoc => 
            updateDoc(doc(db, 'listings', listingDoc.id), {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              sellerLat: position.coords.latitude,
              sellerLng: position.coords.longitude,
              updatedAt: serverTimestamp()
            })
          );
          await Promise.all(updatePromises);
          console.log(`Updated ${listingsSnapshot.size} listings with new location`);
        }
      } catch (listingsErr) {
        console.warn('Failed to update listings location:', listingsErr);
        // Don't fail the whole operation if listings update fails
      }

      setProfile(prev => ({ ...prev, location }));
      setLocationError('✓ Location updated successfully!');
      setTimeout(() => setLocationError(''), 3000);
    } catch (error) {
      console.error('Error getting location:', error);
      
      let errorMessage = 'Failed to get current location. ';
      
      // Handle specific geolocation errors
      if (error.code === 1) {
        errorMessage = 'Location permission denied. Please allow location access when prompted and try again.';
      } else if (error.code === 2) {
        errorMessage = 'Location unavailable. Please check your GPS is enabled and you have an internet connection.';
      } else if (error.code === 3) {
        errorMessage = 'Location request timed out. Please try again in an open outdoor area with clear sky view.';
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage += 'Please try again.';
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

  const handleShareWhatsApp = () => {
    const link = getSellerProfileUrl(sellerId);
    const message = `Check out my store: ${profile.storeName || 'My Store'}\n${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareSMS = () => {
    const link = getSellerProfileUrl(sellerId);
    const message = `Check out my store: ${profile.storeName || 'My Store'} ${link}`;
    const smsUrl = `sms:?body=${encodeURIComponent(message)}`;
    window.open(smsUrl, '_blank');
  };

  const handleCopyLink = async () => {
    const link = getSellerProfileUrl(sellerId);
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link copied to clipboard!');
    }
  };

  const isOwnProfile = auth.currentUser && auth.currentUser.uid === sellerId;

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Store Profile</h1>
        <p className="text-gray-600 text-sm">Manage your store information and settings</p>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-700 text-sm font-medium">{success}</div>
        </div>
      )}

      <div className="space-y-8">
        {/* Basic Information */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Basic Information</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Store Name *
              </label>
              <input
                type="text"
                value={profile.storeName}
                onChange={(e) => setProfile(prev => ({ ...prev, storeName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter your store name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={profile.displayName}
                onChange={(e) => setProfile(prev => ({ ...prev, displayName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Your display name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Your contact number"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Store Description
            </label>
            <textarea
              value={profile.description}
              onChange={(e) => setProfile(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              placeholder="Describe your store and what you offer..."
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Website (Optional)
            </label>
            <input
              type="url"
              value={profile.website}
              onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="https://yourwebsite.com"
            />
          </div>
        </div>

        {/* Address & Location */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-lg p-3 sm:p-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Address & Location</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={profile.address}
                onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Street address"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={profile.city}
                onChange={(e) => setProfile(prev => ({ ...prev, city: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="City"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State/Province
              </label>
              <input
                type="text"
                value={profile.state}
                onChange={(e) => setProfile(prev => ({ ...prev, state: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="State"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ZIP/Postal Code
              </label>
              <input
                type="text"
                value={profile.zipCode}
                onChange={(e) => setProfile(prev => ({ ...prev, zipCode: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="ZIP code"
              />
            </div>
          </div>

          {/* Location Update */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-medium text-blue-800">Store Location</h3>
                <p className="text-sm text-blue-600 mt-1">
                  {profile.location
                    ? `Current: ${profile.location.lat.toFixed(4)}, ${profile.location.lng.toFixed(4)}`
                    : 'No location set - Click below to set your location'
                  }
                </p>
                {profile.location && profile.location.accuracy && (
                  <div className="flex items-center mt-1">
                    <p className="text-sm text-blue-600">
                      Accuracy: ±{Math.round(profile.location.accuracy)}m
                    </p>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getAccuracyQuality(profile.location.accuracy).bg} ${getAccuracyQuality(profile.location.accuracy).color}`}>
                      {getAccuracyQuality(profile.location.accuracy).label}
                    </span>
                  </div>
                )}
                {locationError && (
                  <p className={`text-sm mt-2 ${locationError.includes('✓') ? 'text-green-600 font-medium' : 'text-red-600'}`}>
                    {locationError}
                  </p>
                )}
              </div>
              <button
                onClick={handleLocationUpdate}
                disabled={locationLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                {locationLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Getting location...
                  </>
                ) : (
                  <>
                    📍 {profile.location ? 'Update Location' : 'Set Location'}
                  </>
                )}
              </button>
            </div>
            
            {/* Accuracy Warning */}
            {profile.location && profile.location.accuracy > 50 && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">⚠️ Low Location Accuracy</p>
                <p className="text-xs text-red-600 mt-1">
                  Your current location accuracy is poor (±{Math.round(profile.location.accuracy)}m). 
                  This may affect delivery accuracy. Try updating your location outdoors or enable 
                  high-accuracy location mode in your device settings.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment & Delivery Options */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Payment & Delivery</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Payment Methods
              </label>
              <div className="space-y-2">
                {['cash', 'card', 'paypal', 'bank'].map(method => (
                  <label key={method} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.paymentMethods.includes(method)}
                      onChange={(e) => {
                        setProfile(prev => ({
                          ...prev,
                          paymentMethods: e.target.checked
                            ? [...prev.paymentMethods, method]
                            : prev.paymentMethods.filter(m => m !== method)
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{method}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Delivery Options
              </label>
              <div className="space-y-2">
                {['pickup', 'local_delivery', 'shipping'].map(option => (
                  <label key={option} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={profile.deliveryOptions.includes(option)}
                      onChange={(e) => {
                        setProfile(prev => ({
                          ...prev,
                          deliveryOptions: e.target.checked
                            ? [...prev.deliveryOptions, option]
                            : prev.deliveryOptions.filter(o => o !== option)
                        }));
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      {option === 'local_delivery' ? 'Local Delivery' :
                       option === 'pickup' ? 'In-Store Pickup' : 'Shipping'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Share Store Link */}
        {isOwnProfile && (
          <div className="bg-white rounded-xl shadow-lg p-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Share Your Store</h2>
            <p className="text-sm text-gray-600 mb-4">
              Share your store link via WhatsApp, SMS, or copy the link directly to let customers discover your products.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                onClick={handleShareWhatsApp}
                className="bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <span className="text-lg">📱</span>
                WhatsApp
              </button>
              <button
                onClick={handleShareSMS}
                className="bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <span className="text-lg">💬</span>
                SMS
              </button>
              <button
                onClick={handleCopyLink}
                className="bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <span className="text-lg">🔗</span>
                Copy Link
              </button>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Your store link (clickable):</p>
              <a
                href={getSellerProfileUrl(sellerId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-mono text-blue-600 hover:text-blue-800 underline break-all"
              >
                {getSellerProfileUrl(sellerId)}
              </a>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6">
          <button
            onClick={onBack}
            className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <span className="text-lg">💾</span>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerProfile;
