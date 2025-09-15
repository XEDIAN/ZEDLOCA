import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc, serverTimestamp } from 'firebase/firestore';

function Listings({ userId }) {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingId, setEditingId] = useState(null);

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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) {
      setErrorMessage('You appear to be offline. Please check your internet connection and try again.');
      setLoading(false);
      return;
    }
    if (!userId) {
      alert('You must be logged in to create a listing');
      return;
    }
    if (!form.title || !form.title.trim()) {
      alert('Please enter a title for your listing');
      return;
    }
    if (!form.price || !form.price.trim()) {
      alert('Please enter a price for your listing');
      return;
    }
    if (isNaN(form.price)) {
      alert('Please enter a valid price (numbers only)');
      return;
    }
    if (!form.description || !form.description.trim()) {
      alert('Please enter a description for your listing');
      return;
    }
    try {
      await addDoc(collection(db, 'listings'), {
        userId,
        title: form.title,
        price: form.price,
        description: form.description,
        createdAt: serverTimestamp(),
      });
      setForm({ title: '', price: '', description: '' });
      setSuccessMessage('Listing created successfully!');
      setErrorMessage('');
      // Prompt seller to register location via popup
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await updateDoc(doc(db, 'sellers', userId), {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              updatedAt: new Date(),
            });
            alert('Your location has been registered!');
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
    setForm({ title: '', price: '', description: '' });
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">My Listings</h3>
      {loading && (
        <div className="flex justify-center items-center mb-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-blue-600"></div>
          <span className="ml-3 text-blue-600 font-medium">Loading...</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {errorMessage}
        </div>
      )}
      {successMessage && (
  <div className="mb-4 p-3 bg-gray-200 text-gray-700 rounded">
          {successMessage}
        </div>
      )}
      <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-gray-50">
        <h4 className="font-semibold mb-2">{editingId ? 'Edit Listing' : 'Add New Listing'}</h4>
        <div className="mb-2">
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Title"
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div className="mb-2">
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Price"
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div className="mb-2">
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Description"
            className="border p-2 rounded w-full"
            required
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded" disabled={loading}>
            {loading ? 'Saving...' : editingId ? 'Update Listing' : 'Add Listing'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-gray-500 text-white px-4 py-2 rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {listings.map(listing => (
          <div key={listing.id} className="border rounded p-4 bg-white shadow flex flex-col">
            <div className="flex items-center mb-2">
              <span className="mr-2 text-2xl" role="img" aria-label="Listing">📦</span>
              <h4 className="font-bold text-lg">{listing.title}</h4>
            </div>
            <p className="text-gray-700 font-semibold">{listing.price}</p>
            <p className="text-gray-600 text-sm mb-2">{listing.description}</p>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleEdit(listing)}
                className="bg-yellow-500 text-white px-3 py-1 rounded text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(listing.id)}
                className="bg-red-500 text-white px-3 py-1 rounded text-sm"
              >
                Delete
              </button>
              <button
                onClick={() => alert(`Details for ${listing.title}:\nPrice: ${listing.price}\nDescription: ${listing.description}`)}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
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
