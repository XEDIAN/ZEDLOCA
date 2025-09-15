import React, { useState } from 'react';
import SellerLocationButton from './SellerLocationButton';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

function SellerProfileForm({ sellerId, initialData, onSaved }) {
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [whatsapp, setWhatsapp] = useState(initialData?.whatsapp || '');
  const [location, setLocation] = useState({ lat: initialData?.lat || '', lng: initialData?.lng || '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setError('Unable to get location: ' + err.message);
      }
    , null, { enableHighAccuracy: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await setDoc(doc(db, 'sellers', sellerId), {
        displayName,
        email,
        phone,
        whatsapp,
        lat: location.lat,
        lng: location.lng,
      }, { merge: true });
      setLoading(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <form className="bg-white p-6 rounded shadow max-w-md mx-auto mt-8 flex flex-col gap-4" onSubmit={handleSubmit}>
      <h2 className="text-xl font-bold mb-2">Update Seller Profile</h2>
      <input type="text" className="border rounded px-3 py-2" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
      <input type="email" className="border rounded px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="text" className="border rounded px-3 py-2" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
      <input type="text" className="border rounded px-3 py-2" placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
      <div className="flex gap-2 items-center">
        <button type="button" className="bg-gray-700 text-white px-3 py-1 rounded" onClick={handleLocation}>Share Location</button>
        {location.lat && location.lng && (
          <span className="text-sm text-gray-600">Lat: {location.lat}, Lng: {location.lng}</span>
        )}
      </div>
      {/* Alternative: Seller can also use the dedicated location button below */}
      <SellerLocationButton />
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" className="bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500 text-gray-900 font-bold px-6 py-2 rounded-lg shadow hover:from-gray-500 hover:to-gray-700 transition" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
    </form>
  );
}

export default SellerProfileForm;
