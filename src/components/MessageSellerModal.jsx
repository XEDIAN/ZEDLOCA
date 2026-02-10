import React, { useState, useEffect } from 'react';

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - sellerId: string
 * - sellerName: string
 * - buyerId: string
 * - listing: object (optional) - listing context
 * - seller: object (optional) - seller details
 */
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';

const MESSAGE_TEMPLATES = {
  'price-inquiry': 'Hi! I\'m interested in this item. Is the price negotiable?',
  'availability': 'Hello! Is this item still available?',
  'custom-order': 'Hi! Can you make a custom version of this item?',
  'shipping': 'Hello! What are the shipping options and costs?',
  'condition': 'Hi! Can you tell me more about the condition of this item?'
};

const MAX_MESSAGE_LENGTH = 500;

function MessageSellerModal({ open, onClose, sellerId, sellerName, buyerId, listing, seller }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [recentMessages, setRecentMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [buyerLocation, setBuyerLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [userProfiles, setUserProfiles] = useState({});

  // Load recent message history
  useEffect(() => {
    if (open && sellerId && buyerId) {
      loadMessageHistory();
      loadUserProfiles();
    }
  }, [open, sellerId, buyerId]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setSubject(listing ? `Regarding: ${listing.title}` : '');
      setMessage('');
      setSelectedTemplate('');
      setSuccess(false);
      setError('');
      setShowConfirmation(false);
    }
  }, [open, listing]);

  const loadMessageHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'messages'),
        where('sellerId', '==', sellerId),
        where('buyerId', '==', buyerId),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentMessages(messages.reverse()); // Show oldest first
    } catch (err) {
      console.error('Error loading message history:', err);
    }
    setLoadingHistory(false);
  };

  const loadUserProfiles = async () => {
    try {
      const profiles = {};
      const userIds = [buyerId, sellerId];
      for (const userId of userIds) {
        try {
          const userRef = doc(db, 'users', userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            profiles[userId] = {
              displayName: userData.displayName || userData.name || userData.email || 'Unknown User',
              email: userData.email || '',
            };
          } else {
            profiles[userId] = {
              displayName: userId,
              email: '',
            };
          }
        } catch (error) {
          console.error('Error loading user profile for', userId, error);
          profiles[userId] = {
            displayName: 'Unknown User',
            email: '',
          };
        }
      }
      setUserProfiles(profiles);
    } catch (error) {
      console.error('Error loading user profiles:', error);
    }
  };

  const handleTemplateSelect = (templateKey) => {
    setSelectedTemplate(templateKey);
    setMessage(MESSAGE_TEMPLATES[templateKey]);
  };

  const handleLocationCapture = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setBuyerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocationError('Unable to get location: ' + err.message);
      },
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();

    // Enhanced validation
    if (message.trim().length < 10) {
      setError('Please write a message with at least 10 characters.');
      return;
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`Message is too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }

    // Show confirmation for long messages
    if (message.length > 200 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setSending(true);
    setError('');
    setSuccess(false);
    setShowConfirmation(false);

    try {
      await addDoc(collection(db, 'messages'), {
        sellerId,
        sellerName,
        buyerId,
        subject: subject.trim() || null,
        message: message.trim(),
        listingId: listing?.id || null,
        listingTitle: listing?.title || null,
        buyerLat: buyerLocation?.lat || null,
        buyerLng: buyerLocation?.lng || null,
        timestamp: serverTimestamp(),
        read: false,
      });
      setSuccess(true);
      setMessage('');
      setSubject('');
      setSelectedTemplate('');
      // Reload message history
      loadMessageHistory();
    } catch (err) {
      setError('Failed to send message: ' + err.message);
    }
    setSending(false);
  };

  const remainingChars = MAX_MESSAGE_LENGTH - message.length;
  const isNearLimit = remainingChars < 50;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                  aria-label="Close modal"
                >
                  <span className="text-xl">✕</span>
                </button>
                <div>
                  <h2 className="text-xl font-bold">Message Seller</h2>
                  <p className="text-blue-100">{sellerName || 'Seller'}</p>
                </div>
              </div>
              {seller && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className="text-yellow-300 text-sm">⭐</span>
                    ))}
                    <span className="text-xs text-blue-100">(4.8)</span>
                  </div>
                  <span className="text-xs text-blue-100">• 2h response</span>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Listing Context */}
            {listing && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
                <h3 className="font-semibold text-gray-800 mb-2">Regarding: {listing.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{listing.description}</p>
              </div>
            )}

            {/* Recent Messages */}
            {recentMessages.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <span className="text-lg">💬</span>
                  Recent Messages
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {recentMessages.map((msg) => {
                    const senderProfile = userProfiles[msg.buyerId === buyerId ? msg.buyerId : msg.sellerId];
                    const senderName = msg.buyerId === buyerId ? (senderProfile?.displayName || 'Buyer') : (senderProfile?.displayName || sellerName || 'Seller');
                    return (
                      <div key={msg.id} className={`p-3 rounded-lg text-sm ${
                        msg.buyerId === buyerId
                          ? 'bg-blue-100 ml-8'
                          : 'bg-gray-100 mr-8'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-xs text-gray-600">{senderName}</span>
                        </div>
                        <p className="text-gray-800">{msg.message}</p>
                        {(msg.buyerLat && msg.buyerLng && !msg.fromSeller) || (msg.sellerLat && msg.sellerLng && msg.fromSeller) ? (
                          <div className="mt-2">
                            <button
                              onClick={() => {
                                const lat = msg.fromSeller ? msg.sellerLat : msg.buyerLat;
                                const lng = msg.fromSeller ? msg.sellerLng : msg.buyerLng;
                                if (navigator.geolocation) {
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                      const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
                                      const destination = `${lat},${lng}`;
                                      const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
                                      window.open(url, '_blank');
                                    },
                                    () => {
                                      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                                      window.open(url, '_blank');
                                    }
                                  );
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                              title="Navigate to shared location"
                            >
                              🧭 Navigate
                            </button>
                          </div>
                        ) : null}
                        <p className="text-xs text-gray-500 mt-1">
                          {msg.timestamp?.toDate?.()?.toLocaleDateString() || 'Recent'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Templates */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">Quick Templates</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(MESSAGE_TEMPLATES).map(([key, template]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleTemplateSelect(key)}
                    className={`p-2 text-left text-sm rounded border transition-colors ${
                      selectedTemplate === key
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Location Capture */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">Share Your Location (Optional)</h3>
              <p className="text-sm text-gray-600 mb-2">Allow the seller to see your location for easier navigation.</p>
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <button
                  type="button"
                  onClick={handleLocationCapture}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  📍 Share Location
                </button>
                {buyerLocation && (
                  <span className="text-sm text-green-600">
                    ✓ Location captured: {buyerLocation.lat.toFixed(4)}, {buyerLocation.lng.toFixed(4)}
                  </span>
                )}
              </div>
              {locationError && (
                <p className="text-red-600 text-sm mt-1">{locationError}</p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSend}>
              {/* Subject */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject (Optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief subject for your message..."
                  disabled={sending}
                />
              </div>

              {/* Message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                    message.length > MAX_MESSAGE_LENGTH ? 'border-red-500' : 'border-gray-300'
                  }`}
                  rows={4}
                  placeholder="Type your message..."
                  disabled={sending}
                  required
                />
                <div className="flex justify-between items-center mt-1">
                  <div className="text-xs text-gray-500">
                    {remainingChars} characters remaining
                  </div>
                  {isNearLimit && (
                    <div className="text-xs text-orange-600">
                      Approaching limit
                    </div>
                  )}
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-green-700 text-sm">Message sent successfully!</div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={sending || !message.trim() || message.length > MAX_MESSAGE_LENGTH}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Long Message Warning</h3>
            <p className="text-gray-600 mb-4">
              Your message is quite long ({message.length} characters). Are you sure you want to send it?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Edit Message
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  // Trigger form submission
                  const form = document.querySelector('form');
                  if (form) form.requestSubmit();
                }}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
              >
                Send Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MessageSellerModal;
