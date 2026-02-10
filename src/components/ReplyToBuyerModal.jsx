import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - buyerId: string
 * - sellerId: string
 * - originalMessageId: string
 */
function ReplyToBuyerModal({ open, onClose, buyerId, sellerId, originalMessageId }) {
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sellerLocation, setSellerLocation] = useState(null);
  const [locationError, setLocationError] = useState('');

  if (!open) return null;

  const handleLocationCapture = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSellerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocationError('Unable to get location: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);
    try {
      await addDoc(collection(db, 'messages'), {
        sellerId,
        buyerId,
        replyTo: originalMessageId,
        message: reply,
        fromSeller: true,
        sellerLat: sellerLocation?.lat || null,
        sellerLng: sellerLocation?.lng || null,
        timestamp: serverTimestamp(),
        read: false,
      });
      setSuccess(true);
      setReply('');
      setSellerLocation(null);
    } catch (err) {
      setError('Failed to send reply: ' + err.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2">Reply to Buyer</h2>
        <form onSubmit={handleSend}>
          <textarea
            className="w-full border rounded p-2 mb-2"
            rows={4}
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type your reply..."
            required
            disabled={sending}
          />

          {/* Location Sharing */}
          <div className="mb-4">
            <h3 className="font-semibold text-gray-800 mb-2">Share Your Location (Optional)</h3>
            <p className="text-sm text-gray-600 mb-2">Allow the buyer to see your location for easier navigation.</p>
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <button
                type="button"
                onClick={handleLocationCapture}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                disabled={sending}
              >
                📍 Share Location
              </button>
              {sellerLocation && (
                <span className="text-sm text-green-600">
                  ✓ Location captured: {sellerLocation.lat.toFixed(4)}, {sellerLocation.lng.toFixed(4)}
                </span>
              )}
            </div>
            {locationError && (
              <p className="text-red-600 text-sm mt-1">{locationError}</p>
            )}
          </div>

          {error && <div className="text-red-600 mb-2">{error}</div>}
          {success && <div className="text-green-600 mb-2">Reply sent!</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 rounded bg-gray-300" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="px-4 py-1 rounded bg-blue-600 text-white" disabled={sending || !reply.trim()}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReplyToBuyerModal;
