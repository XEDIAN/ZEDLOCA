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
  const [promoActive, setPromoActive] = useState(initialData?.promo_active || false);
  const [promoText, setPromoText] = useState(initialData?.promo_text || '');
  const [promoRadius, setPromoRadius] = useState(initialData?.promo_radius_meters || 200);
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
        promo_active: promoActive,
        promo_text: promoText,
        promo_radius_meters: promoRadius,
      }, { merge: true });
      setLoading(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError('Failed to save profile: ' + err.message);
      setLoading(false);
    }
  };

  const handleRemovePromo = async () => {
    if (!window.confirm('Remove promotion for this seller?')) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'sellers', sellerId), {
        promo_active: false,
        promo_text: '',
        promo_radius_meters: 0,
      }, { merge: true });
      setPromoActive(false);
      setPromoText('');
      setPromoRadius(200);
      setLoading(false);
      if (onSaved) onSaved();
    } catch (err) {
      setError('Failed to remove promotion: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <form className="bg-white p-3 sm:p-6 rounded shadow max-w-xs sm:max-w-md mx-auto mt-4 sm:mt-8 flex flex-col gap-3 sm:gap-4" onSubmit={handleSubmit}>
      <h2 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Update Seller Profile</h2>
      <input type="text" className="border rounded px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base" placeholder="Display Name" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
      <input type="email" className="border rounded px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="text" className="border rounded px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base" placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
      <input type="text" className="border rounded px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base" placeholder="WhatsApp" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-center">
        <button type="button" className="bg-gray-700 text-white px-2 py-1 sm:px-3 sm:py-1 rounded text-xs sm:text-sm" onClick={handleLocation}>Share Location</button>
        {location.lat && location.lng && (
          <span className="text-xs sm:text-sm text-gray-600">Lat: {location.lat}, Lng: {location.lng}</span>
        )}
      </div>
      {/* Promo fields */}
      <div className="flex items-center gap-2">
        <input id="promoActive" type="checkbox" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} className="h-4 w-4" />
        <label htmlFor="promoActive" className="text-sm">Enable Promotion</label>
      </div>
      {promoActive && (
        <>
          <input type="text" className="border rounded px-2 py-1 sm:px-3 sm:py-2 text-sm sm:text-base" placeholder="Promotion text (e.g., 10% off)" value={promoText} onChange={e => setPromoText(e.target.value)} />
          <div className="flex items-center gap-2">
            <label className="text-sm">Radius (meters)</label>
            <input type="number" min="50" step="10" className="border rounded px-2 py-1 w-24" value={promoRadius} onChange={e => setPromoRadius(Number(e.target.value))} />
          </div>
        </>
      )}
      {/* Alternative: Seller can also use the dedicated location button below */}
      <SellerLocationButton />
      {error && <p className="text-red-600 text-xs sm:text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500 text-gray-900 font-bold px-4 py-2 sm:px-6 rounded-lg shadow hover:from-gray-500 hover:to-gray-700 transition text-sm sm:text-base" disabled={loading}>{loading ? 'Saving...' : 'Save Profile'}</button>
        {promoActive && (
          <button type="button" onClick={handleRemovePromo} className="bg-red-500 text-white px-3 py-2 rounded text-sm" disabled={loading}>Remove Promotion</button>
        )}
      </div>
    </form>
  );
}

export default SellerProfileForm;
