import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import ReplyToBuyerModal from './ReplyToBuyerModal';

function SellerInbox({ sellerId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyModal, setReplyModal] = useState({ open: false, buyerId: '', originalMessageId: '' });

  useEffect(() => {
    if (!sellerId) return;
    setLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('sellerId', '==', sellerId),
      orderBy('timestamp', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      setError('Failed to load messages: ' + err.message);
      setLoading(false);
    });
    return () => unsub();
  }, [sellerId]);

  const markAsRead = async (msgId) => {
    try {
      await updateDoc(doc(db, 'messages', msgId), { read: true });
    } catch (err) {
      alert('Failed to mark as read: ' + err.message);
    }
  };

  if (!sellerId) return null;
  if (loading) return <div>Loading messages...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="bg-white rounded shadow p-4 max-w-lg mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">Inbox</h2>
      {messages.length === 0 ? (
        <div>No messages yet.</div>
      ) : (
        <ul>
          {messages.map(msg => (
            <li key={msg.id} className={`mb-4 p-3 rounded ${msg.read ? 'bg-gray-100' : 'bg-blue-50'}`}>
              <div className="mb-1 text-sm text-gray-600">From: {msg.buyerId}</div>
              <div className="mb-2">{msg.message}</div>
              <div className="text-xs text-gray-500 mb-1">{msg.timestamp?.toDate?.().toLocaleString?.() || ''}</div>
              <div className="flex gap-2 mt-1">
                {!msg.read && (
                  <button className="text-xs text-blue-700 underline" onClick={() => markAsRead(msg.id)}>Mark as read</button>
                )}
                <button
                  className="text-xs text-green-700 underline"
                  onClick={() => setReplyModal({ open: true, buyerId: msg.buyerId, originalMessageId: msg.id })}
                >Reply</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ReplyToBuyerModal
        open={replyModal.open}
        onClose={() => setReplyModal({ open: false, buyerId: '', originalMessageId: '' })}
        buyerId={replyModal.buyerId}
        sellerId={sellerId}
        originalMessageId={replyModal.originalMessageId}
      />
    </div>
  );
}

export default SellerInbox;
