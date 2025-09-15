import React, { useState } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase';

function SellerLocationButton({ onLocationSaved }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleShareLocation = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const user = auth.currentUser;
        if (!user) {
          setError('You must be signed in to share your location.');
          setLoading(false);
          return;
        }
        try {
          await setDoc(doc(db, 'sellers', user.uid), {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            updatedAt: new Date(),
          }, { merge: true });
          setSuccess('Location shared successfully!');
          setLoading(false);
          if (onLocationSaved) onLocationSaved(pos.coords);
        } catch (err) {
          setError('Failed to save location: ' + err.message);
          setLoading(false);
        }
      },
      (err) => {
        setError('Unable to get location: ' + err.message);
        setLoading(false);
      }
    , null, { enableHighAccuracy: true });
  };

  return (
    <div className="flex flex-col items-center gap-2 mt-4">
      <button
        className="bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500 text-gray-900 font-bold px-6 py-2 rounded-lg shadow hover:from-gray-500 hover:to-gray-700 transition"
        onClick={handleShareLocation}
        disabled={loading}
      >
        {loading ? 'Sharing Location...' : 'Share My Current Location'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {success && <p className="text-green-600 text-sm">{success}</p>}
    </div>
  );
}

export default SellerLocationButton;
