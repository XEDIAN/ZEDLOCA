import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import ImageUpload from './ImageUpload';
import { useCurrency } from './CurrencyContext';

function Listings({ userId }) {
  const { formatPrice } = useCurrency();
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', description: '', category: '' });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [uploadedImages, setUploadedImages] = useState([]);

  const [sellerPromo, setSellerPromo] = useState(null);
  const [loadingPromo, setLoadingPromo] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Query listings for this user, ordered by newest first (requires composite index on userId + createdAt desc)
    const q = query(
      collection(db, 'listings'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const toMs = (t) => {
          try {
            if (!t) return 0;
            if (typeof t.toMillis === 'function') return t.toMillis();
            return new Date(t).getTime() || 0;
          } catch {
            return 0;
          }
        };
        const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort newest first
        docs.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
        setListings(docs);
        setErrorMessage('');
      },
      (error) => {
        console.error('Listings listener error:', error);
        const msg = error?.message || 'Failed to load listings.';
        setErrorMessage(
          msg.toLowerCase().includes('index')
            ? msg
            : 'Failed to load listings. Check Firestore rules and required composite indexes. ' + msg
        );
      }
    );
    return () => unsub();
  }, [userId]);

  // Load seller promo info for the current user
  useEffect(() => {
    if (!userId) {
      setSellerPromo(null);
      return;
    }
    let cancelled = false;
    const loadPromo = async () => {
      setLoadingPromo(true);
      try {
        const d = doc(db, 'sellers', userId);
        const snap = await getDoc(d);
        if (cancelled) return;
        if (snap.exists()) {
          setSellerPromo({ id: snap.id, ...snap.data() });
        } else {
          setSellerPromo(null);
        }
      } catch (err) {
        console.error('Failed to load seller promo:', err);
        setSellerPromo(null);
      } finally {
        if (!cancelled) setLoadingPromo(false);
      }
    };
    loadPromo();
    return () => { cancelled = true; };
  }, [userId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!navigator.onLine) {
      setErrorMessage('You appear to be offline. Please check your internet connection and try again.');
      setLoading(false);
      return;
    }
    if (!userId) {
      alert('You must be logged in to create a listing');
      setLoading(false);
      return;
    }
    if (!form.title || !form.title.trim()) {
      alert('Please enter a title for your listing');
      setLoading(false);
      return;
    }
    if (!form.price || !form.price.trim()) {
      alert('Please enter a price for your listing');
      setLoading(false);
      return;
    }
    if (isNaN(form.price)) {
      alert('Please enter a valid price (numbers only)');
      setLoading(false);
      return;
    }
    if (!form.description || !form.description.trim()) {
      alert('Please enter a description for your listing');
      setLoading(false);
      return;
    }
    try {
      await addDoc(collection(db, 'listings'), {
        userId,
        title: form.title,
        price: form.price,
        description: form.description,
        category: form.category,
        images: uploadedImages.map(img => img.url),
        createdAt: serverTimestamp(),
      });
      setForm({ title: '', price: '', description: '', category: '' });
      setSuccessMessage('Listing created successfully!');
      setErrorMessage('');
      // Prompt seller to register location via popup and optionally enable a promotion
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            try {
              await updateDoc(doc(db, 'sellers', userId), {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                updatedAt: new Date(),
              });
              // After registering location, ask seller if they want to enable a promotion for this listing
              const enablePromo = window.confirm('Your location was registered. Would you like to enable a promotion for this listing?');
              if (enablePromo) {
                const pText = window.prompt('Enter promotion text (e.g., "10% off today"):', '10% off today') || '';
                const pRadiusStr = window.prompt('Enter promotion radius in meters (e.g., 200):', '200') || '200';
                const pRadius = Number(pRadiusStr) || 200;
                try {
                  await updateDoc(doc(db, 'sellers', userId), {
                    promo_active: true,
                    promo_text: pText,
                    promo_radius_meters: pRadius,
                    updatedAt: new Date(),
                  });
                  // refresh local promo state
                  setSellerPromo(prev => ({ ...(prev || {}), promo_active: true, promo_text: pText, promo_radius_meters: pRadius }));
                  alert('Your location and promotion have been saved!');
                } catch (promoErr) {
                  console.error('Failed to save promotion:', promoErr);
                  alert('Location saved but failed to enable promotion: ' + (promoErr.message || promoErr));
                }
              } else {
                alert('Your location has been registered!');
              }
            } catch (errUpdate) {
              console.error('Failed to update seller location:', errUpdate);
              alert('Failed to save location: ' + (errUpdate.message || errUpdate));
            }
          },
          (err) => {
            alert('Failed to get location: ' + err.message);
          },
          { enableHighAccuracy: true }
        );
      }
    } catch (err) {
      setErrorMessage('Failed to create listing: ' + err.message);
    }
    setLoading(false);
  };

  const handleEdit = (listing) => {
    setForm({
      title: listing.title,
      price: listing.price,
      description: listing.description,
      category: listing.category || '',
    });
    setEditingId(listing.id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await deleteDoc(doc(db, 'listings', id));
      } catch (err) {
        alert('Error deleting listing: ' + err.message);
      }
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ title: '', price: '', description: '', category: '' });
  };

  // Manage promotion actions available in listings UI
  const handleEditPromo = async () => {
    if (!userId) {
      alert('Sign in to manage promotions.');
      return;
    }
    const pText = window.prompt('Enter promotion text (leave blank to cancel):', sellerPromo?.promo_text || '10% off today');
    if (pText === null) return; // cancelled
    const pRadiusStr = window.prompt('Enter promotion radius in meters:', String(sellerPromo?.promo_radius_meters || 200));
    if (pRadiusStr === null) return;
    const pRadius = Number(pRadiusStr) || 200;
    try {
      await updateDoc(doc(db, 'sellers', userId), {
        promo_active: true,
        promo_text: pText,
        promo_radius_meters: pRadius,
        updatedAt: new Date(),
      });
      setSellerPromo(prev => ({ ...(prev || {}), promo_active: true, promo_text: pText, promo_radius_meters: pRadius }));
      alert('Promotion updated.');
    } catch (err) {
      console.error('Failed to update promotion:', err);
      alert('Failed to update promotion: ' + err.message);
    }
  };

  const handleClearPromo = async () => {
    if (!userId) {
      alert('Sign in to manage promotions.');
      return;
    }
    if (!window.confirm('Clear and disable your promotion?')) return;
    try {
      await updateDoc(doc(db, 'sellers', userId), {
        promo_active: false,
        promo_text: '',
        promo_radius_meters: 0,
        updatedAt: new Date(),
      });
      setSellerPromo(prev => ({ ...(prev || {}), promo_active: false, promo_text: '', promo_radius_meters: 0 }));
      alert('Promotion cleared.');
    } catch (err) {
      console.error('Failed to clear promotion:', err);
      alert('Failed to clear promotion: ' + err.message);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">📦 My Listings</h2>
        <p className="text-gray-600">Manage your product listings and promotions</p>
      </div>

      {/* Promotion management UI for sellers */}
      {userId && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Promotion Management</h3>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-gray-700">
                {loadingPromo ? (
                  <span className="text-blue-600">Loading promotion...</span>
                ) : sellerPromo?.promo_active ? (
                  <span className="text-green-600 font-medium">
                    Active: "{sellerPromo.promo_text}" — {sellerPromo.promo_radius_meters}m radius
                  </span>
                ) : (
                  <span className="text-gray-500">No active promotion</span>
                )}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEditPromo}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                Edit Promotion
              </button>
              <button
                onClick={handleClearPromo}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
              >
                Clear Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600 text-lg">Loading listings...</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <div className="flex items-center">
            <div className="text-red-500 mr-3">⚠️</div>
            <p className="text-red-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <div className="flex items-center">
            <div className="text-green-500 mr-3">✅</div>
            <p className="text-green-700">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6">
          <h3 className="text-xl font-bold">{editingId ? 'Edit Listing' : 'Create New Listing'}</h3>
          <p className="text-blue-100 mt-1">{editingId ? 'Update your listing details' : 'Add a new product to your store'}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="Enter listing title"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
              <input
                name="price"
                value={form.price}
                onChange={handleChange}
                placeholder="Enter price"
                type="number"
                step="0.01"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Category</option>
              <option value="electronics">Electronics</option>
              <option value="clothing">Clothing</option>
              <option value="home">Home & Garden</option>
              <option value="sports">Sports</option>
              <option value="books">Books</option>
              <option value="automotive">Automotive</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe your product in detail"
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Images</label>
            <ImageUpload onImagesUploaded={setUploadedImages} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Saving...' : editingId ? 'Update Listing' : 'Create Listing'}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Listings Grid */}
      {listings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 sm:p-12 text-center">
          <div className="text-4xl sm:text-6xl mb-4">📦</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">No listings yet</h3>
          <p className="text-sm sm:text-base text-gray-500">Create your first listing to get started selling!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {listings.map(listing => (
            <div key={listing.id} className="bg-white rounded-lg sm:rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
              {/* Listing Header */}
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-3 sm:p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-bold mb-1">{listing.title}</h3>
                    <p className="text-blue-100 text-xs">
                      {listing.category && `${listing.category.charAt(0).toUpperCase() + listing.category.slice(1)} • `}
                      Created {listing.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </p>
                  </div>
                  <div className="text-lg sm:text-xl ml-2">📦</div>
                </div>
              </div>

              {/* Listing Details */}
              <div className="p-3 sm:p-4">
                <div className="mb-3">
                  <div className="text-lg sm:text-xl font-bold text-green-600 mb-1">{formatPrice(listing.price)}</div>
                  <p className="text-gray-600 text-xs sm:text-sm line-clamp-3">{listing.description}</p>
                </div>

                {/* Images Preview */}
                {listing.images && listing.images.length > 0 && (
                  <div className="mb-3">
                    <div className="flex gap-1 overflow-x-auto">
                      {listing.images.slice(0, 3).map((image, index) => (
                        <img
                          key={index}
                          src={image}
                          alt={`${listing.title} ${index + 1}`}
                          className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded border border-gray-200 flex-shrink-0"
                        />
                      ))}
                      {listing.images.length > 3 && (
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                          +{listing.images.length - 3}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-1">
                  <div className="flex flex-col sm:flex-row gap-1">
                    <button
                      onClick={() => handleEdit(listing)}
                      className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-2 sm:px-3 py-1.5 rounded transition-colors font-medium text-xs sm:text-sm min-h-[36px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(listing.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white px-2 sm:px-3 py-1.5 rounded transition-colors font-medium text-xs sm:text-sm min-h-[36px]"
                    >
                      Delete
                    </button>
                  </div>
                  <button
                    onClick={() => alert(`Details for ${listing.title}:\nPrice: $${listing.price}\nDescription: ${listing.description}\nCategory: ${listing.category || 'Not specified'}`)}
                    className="w-full bg-blue-100 text-blue-700 px-2 sm:px-3 py-1.5 rounded hover:bg-blue-200 transition-colors font-medium text-xs sm:text-sm min-h-[36px]"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Listings;
