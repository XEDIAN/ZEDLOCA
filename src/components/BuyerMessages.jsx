import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

function BuyerMessages({ buyerId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!buyerId) return;
    setLoading(true);
    const q = query(
      collection(db, 'messages'),
      where('buyerId', '==', buyerId),
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
  }, [buyerId]);

  if (!buyerId) return null;
  if (loading) return <div>Loading messages...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="bg-white rounded shadow p-4 max-w-lg mx-auto mt-8">
      <h2 className="text-xl font-bold mb-4">My Messages</h2>
      {messages.length === 0 ? (
        <div>No messages yet.</div>
      ) : (
        <ul>
          {messages.map(msg => (
            <li key={msg.id} className={`mb-4 p-3 rounded ${msg.fromSeller ? 'bg-green-50' : 'bg-blue-50'}`}>
              <div className="mb-1 text-sm text-gray-600">{msg.fromSeller ? 'Reply from Seller' : 'You sent:'}</div>
              <div className="mb-2">{msg.message}</div>
              <div className="text-xs text-gray-500 mb-1">{msg.timestamp?.toDate?.().toLocaleString?.() || ''}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default BuyerMessages;
