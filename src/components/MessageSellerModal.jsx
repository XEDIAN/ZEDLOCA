import React, { useState } from 'react';

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - sellerId: string
 * - sellerName: string
 * - buyerId: string
 */
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function MessageSellerModal({ open, onClose, sellerId, sellerName, buyerId }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setError('');
    setSuccess(false);
    try {
      await addDoc(collection(db, 'messages'), {
        sellerId,
        sellerName,
        buyerId,
        message,
        timestamp: serverTimestamp(),
        read: false,
      });
      setSuccess(true);
      setMessage('');
    } catch (err) {
      setError('Failed to send message: ' + err.message);
    }
    setSending(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded shadow-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-bold mb-2">Message {sellerName || 'Seller'}</h2>
        <form onSubmit={handleSend}>
          <textarea
            className="w-full border rounded p-2 mb-2"
            rows={4}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Type your message..."
            required
            disabled={sending}
          />
          {error && <div className="text-red-600 mb-2">{error}</div>}
          {success && <div className="text-green-600 mb-2">Message sent!</div>}
          <div className="flex justify-end gap-2">
            <button type="button" className="px-3 py-1 rounded bg-gray-300" onClick={onClose} disabled={sending}>Cancel</button>
            <button type="submit" className="px-4 py-1 rounded bg-blue-600 text-white" disabled={sending || !message.trim()}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MessageSellerModal;
