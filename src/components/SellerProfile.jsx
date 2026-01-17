import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';

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
    businessHours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '17:00', closed: false },
      sunday: { open: '09:00', close: '17:00', closed: true }
    },
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
          ...data,
          businessHours: {
            ...prev.businessHours,
            ...data.businessHours
          }
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

    try {
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported'));
          return;
        }

        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        });
      });

      const location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: new Date().toISOString()
      };

      setProfile(prev => ({ ...prev, location }));
      setLocationError('Location updated successfully!');
      setTimeout(() => setLocationError(''), 3000);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Failed to get current location. Please try again.');
    } finally {
      setLocationLoading(false);
    }
  };

  const updateBusinessHours = (day, field, value) => {
    setProfile(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: {
          ...prev.businessHours[day],
          [field]: value
        }
      }
    }));
  };

  const toggleDayClosed = (day) => {
    setProfile(prev => ({
      ...prev,
      businessHours: {
        ...prev.businessHours,
        [day]: {
          ...prev.businessHours[day],
          closed: !prev.businessHours[day].closed
        }
      }
    }));
  };

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
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Information</h2>
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
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Address & Location</h2>

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
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-800">Store Location</h3>
                <p className="text-sm text-blue-600 mt-1">
                  {profile.location
                    ? `Current: ${profile.location.lat.toFixed(4)}, ${profile.location.lng.toFixed(4)}`
                    : 'No location set'
                  }
                </p>
                {locationError && (
                  <p className={`text-sm mt-1 ${locationError.includes('successfully') ? 'text-green-600' : 'text-red-600'}`}>
                    {locationError}
                  </p>
                )}
              </div>
              <button
                onClick={handleLocationUpdate}
                disabled={locationLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
              >
                {locationLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    Update Location
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Business Hours */}
        <div className="bg-white rounded-xl shadow-lg p-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Business Hours</h2>
          <div className="space-y-4">
            {Object.entries(profile.businessHours).map(([day, hours]) => (
              <div key={day} className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg">
                <div className="w-24 font-medium text-gray-700 capitalize">
                  {day}
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hours.closed}
                    onChange={() => toggleDayClosed(day)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">Closed</span>
                </label>

                {!hours.closed && (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Open:</label>
                      <input
                        type="time"
                        value={hours.open}
                        onChange={(e) => updateBusinessHours(day, 'open', e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Close:</label>
                      <input
                        type="time"
                        value={hours.close}
                        onChange={(e) => updateBusinessHours(day, 'close', e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
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
