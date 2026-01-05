import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, serverTimestamp, getDoc } from 'firebase/firestore';

function Listings({ userId }) {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', description: '', category: '' });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState(null);

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
    <div className="listings-container mt-4 sm:mt-6">
      <h3 className="text-sm sm:text-base font-semibold mb-2">My Listings</h3>

      {/* Promotion management UI for sellers */}
      {userId && (
        <div className="mb-3 p-2 bg-gray-50 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <p className="text-xs text-gray-700">
              {loadingPromo ? 'Loading promotion...' : sellerPromo?.promo_active ? `Active promotion: "${sellerPromo.promo_text}" — ${sellerPromo.promo_radius_meters} m` : 'No active promotion'}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleEditPromo} className="bg-yellow-500 text-white px-2 py-1 rounded text-xs">Edit Promotion</button>
            <button onClick={handleClearPromo} className="bg-red-500 text-white px-2 py-1 rounded text-xs">Clear Promotion</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center items-center mb-3">
          <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-b-4 border-blue-600"></div>
          <span className="ml-3 text-blue-600 font-medium">Loading...</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-3 p-2 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}
      {successMessage && (
        <div className="mb-3 p-2 bg-gray-200 text-gray-700 rounded">
          {successMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mb-3 p-1 sm:p-2 border rounded bg-gray-50">
        <h4 className="font-semibold mb-2 text-base sm:text-lg">{editingId ? 'Edit Listing' : 'Add New Listing'}</h4>
        <div className="mb-2">
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Title"
            className="border p-1 rounded w-full text-sm"
            required
          />
        </div>
        <div className="mb-2">
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Price"
            className="border p-1 rounded w-full text-sm"
            required
          />
        </div>
        <div className="mb-2">
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Description"
            className="border p-1 rounded w-full text-sm"
            required
          />
        </div>
        <div className="mb-2">
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="border p-1 rounded w-full text-sm"
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
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="submit" className="bg-blue-600 text-white px-2 py-1 sm:px-3 sm:py-1 rounded text-sm" disabled={loading}>
            {loading ? 'Saving...' : editingId ? 'Update Listing' : 'Add Listing'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-gray-500 text-white px-2 py-1 sm:px-3 sm:py-1 rounded text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {listings.map(listing => (
          <div key={listing.id} className="border rounded p-2 sm:p-3 bg-white shadow-sm flex flex-col listings-card">
            <div className="flex items-center mb-2">
              <span className="mr-2 text-lg sm:text-xl" role="img" aria-label="Listing">📦</span>
              <h4 className="font-bold text-sm sm:text-base">{listing.title}</h4>
            </div>
            <p className="text-gray-700 font-semibold text-sm">{listing.price}</p>
            <p className="text-gray-600 text-xs sm:text-sm mb-2">{listing.description}</p>
            <div className="flex gap-1 sm:gap-2 mt-2">
              <button
                onClick={() => handleEdit(listing)}
                className="bg-yellow-500 text-white px-2 py-1 sm:px-3 rounded text-xs sm:text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(listing.id)}
                className="bg-red-500 text-white px-2 py-1 sm:px-3 rounded text-xs sm:text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => alert(`Details for ${listing.title}:\nPrice: ${listing.price}\nDescription: ${listing.description}`)}
                className="bg-blue-500 text-white px-2 py-1 sm:px-3 rounded text-xs sm:text-sm"
              >
                Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Listings;
