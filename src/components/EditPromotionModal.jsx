import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

const EditPromotionModal = ({ open, onClose }) => {
  const [promoText, setPromoText] = useState('');
  const [promoRadius, setPromoRadius] = useState(1000);
  const [promoActive, setPromoActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load current promotion data
  useEffect(() => {
    if (open && auth?.currentUser?.uid) {
      loadPromotionData();
    }
  }, [open]);

  const loadPromotionData = async () => {
    if (!auth?.currentUser?.uid) return;

    setLoading(true);
    setError('');
    try {
      const sellerRef = doc(db, 'sellers', auth.currentUser.uid);
      const sellerSnap = await getDoc(sellerRef);

      if (sellerSnap.exists()) {
        const data = sellerSnap.data();
        setPromoText(data.promo_text || '');
        setPromoRadius(data.promo_radius_meters || 1000);
        setPromoActive(data.promo_active || false);
      }
    } catch (err) {
      console.error('Error loading promotion data:', err);
      setError('Failed to load promotion data');
    }
    setLoading(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (!auth?.currentUser?.uid) {
      setError('Please log in to save promotion settings');
      return;
    }

    if (promoActive && !promoText.trim()) {
      setError('Please enter promotion text when activating promotion');
      return;
    }

    if (promoRadius < 100 || promoRadius > 50000) {
      setError('Radius must be between 100 and 50,000 meters');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const sellerRef = doc(db, 'sellers', auth.currentUser.uid);
      await updateDoc(sellerRef, {
        promo_text: promoText.trim(),
        promo_radius_meters: promoRadius,
        promo_active: promoActive,
        updatedAt: serverTimestamp()
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Error saving promotion:', err);
      setError('Failed to save promotion settings');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setPromoText('');
    setPromoRadius(1000);
    setPromoActive(false);
    setError('');
    setSuccess(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <span className="text-xl">✕</span>
            </button>
            <div>
              <h2 className="text-xl font-bold">Edit Promotion</h2>
              <p className="text-yellow-100 text-sm">Set up your store promotion</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto"></div>
              <p className="text-gray-600 mt-2">Loading promotion data...</p>
            </div>
          ) : (
            <form onSubmit={handleSave}>
              {/* Active Toggle */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={promoActive}
                    onChange={(e) => setPromoActive(e.target.checked)}
                    className="mr-3 h-4 w-4 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Activate Promotion
                  </span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  When active, buyers within your radius will see your promotion
                </p>
              </div>

              {/* Promotion Text */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promotion Text *
                </label>
                <textarea
                  value={promoText}
                  onChange={(e) => setPromoText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                  rows={3}
                  placeholder="e.g., 20% off all items today!"
                  disabled={!promoActive}
                  required={promoActive}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {promoText.length}/100 characters
                </p>
              </div>

              {/* Radius */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Promotion Radius (meters)
                </label>
                <input
                  type="number"
                  value={promoRadius}
                  onChange={(e) => setPromoRadius(parseInt(e.target.value) || 1000)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  min="100"
                  max="50000"
                  step="100"
                  disabled={!promoActive}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Buyers within this radius will see your promotion ({promoRadius}m ≈ {(promoRadius / 1000).toFixed(1)}km)
                </p>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-green-700 text-sm">Promotion updated successfully!</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    onClose();
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Promotion'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditPromotionModal;
