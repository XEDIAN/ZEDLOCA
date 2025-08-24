
import React, { useEffect, useState } from 'react';
import { db, storage } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

function Listings({ userId }) {
  const [listings, setListings] = useState([]);
  const [form, setForm] = useState({ title: '', price: '', description: '', image: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'listings'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setListings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [userId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    let imageUrl = form.image;
    try {
      if (file) {
        const storageRef = ref(storage, `listing-images/${userId}/${Date.now()}_${file.name}`);
        await uploadBytes(storageRef, file);
        imageUrl = await getDownloadURL(storageRef);
      }
      
      if (editingId) {
        // Update existing listing
        await updateDoc(doc(db, 'listings', editingId), {
          ...form,
          image: imageUrl,
          updatedAt: new Date(),
        });
        setEditingId(null);
      } else {
        // Create new listing
        await addDoc(collection(db, 'listings'), {
          ...form,
          image: imageUrl,
          userId,
          createdAt: new Date(),
        });
      }
      
      setForm({ title: '', price: '', description: '', image: '' });
      setFile(null);
    } catch (err) {
      alert('Error saving listing: ' + err.message);
    }
    setLoading(false);
  };

  const handleEdit = (listing) => {
    setForm({
      title: listing.title,
      price: listing.price,
      description: listing.description,
      image: listing.image || '',
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
    setForm({ title: '', price: '', description: '', image: '' });
    setFile(null);
  };

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">My Listings</h3>
      <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-gray-50" encType="multipart/form-data">
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
          <label className="block mb-1">Image (upload or paste URL)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="border p-2 rounded w-full mb-1"
          />
          <input
            name="image"
            value={form.image}
            onChange={handleChange}
            placeholder="Image URL (optional if uploading)"
            className="border p-2 rounded w-full"
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
          <div key={listing.id} className="border rounded p-4 bg-white shadow">
            {listing.image && (
              <img src={listing.image} alt={listing.title} className="w-full h-32 object-cover rounded mb-2" />
            )}
            <h4 className="font-bold">{listing.title}</h4>
            <p className="text-green-700 font-semibold">{listing.price}</p>
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Listings;
