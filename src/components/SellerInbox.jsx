import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import ReplyToBuyerModal from './ReplyToBuyerModal';
import ImageLightbox from './ImageLightbox';

function SellerInbox({ sellerId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyModal, setReplyModal] = useState({ open: false, buyerId: '', originalMessageId: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  useEffect(() => {
    if (messages.length === 0) return;

    const uniqueUserIds = new Set();
    messages.forEach(msg => {
      uniqueUserIds.add(msg.buyerId);
    });
    uniqueUserIds.add(sellerId);

    const loadProfiles = async () => {
      const profiles = {};
      for (const userId of uniqueUserIds) {
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
              displayName: 'Unknown User',
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
    };

    loadProfiles();
  }, [messages, sellerId]);

  const conversations = useMemo(() => {
    const grouped = {};
    messages.forEach(msg => {
      const buyerId = msg.buyerId;
      if (!grouped[buyerId]) {
        grouped[buyerId] = {
          buyerId,
          messages: [],
          unreadCount: 0,
          lastMessage: null,
          lastMessageTime: null
        };
      }
      grouped[buyerId].messages.push(msg);
      if (!msg.read && !msg.fromSeller) {
        grouped[buyerId].unreadCount++;
      }
      const msgTime = msg.timestamp?.toDate?.() || new Date(0);
      if (!grouped[buyerId].lastMessageTime || msgTime > grouped[buyerId].lastMessageTime) {
        grouped[buyerId].lastMessage = msg;
        grouped[buyerId].lastMessageTime = msgTime;
      }
    });
    return Object.values(grouped).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [messages]);

  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const buyerName = userProfiles[conv.buyerId]?.displayName || conv.buyerId;
      const matchesSearch = searchTerm === '' ||
        buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.buyerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.messages.some(msg => msg.message?.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesFilter = filter === 'all' ||
        (filter === 'unread' && conv.unreadCount > 0) ||
        (filter === 'read' && conv.unreadCount === 0);

      return matchesSearch && matchesFilter;
    });
  }, [conversations, searchTerm, filter, userProfiles]);

  const markAsRead = async (msgId) => {
    try {
      await updateDoc(doc(db, 'messages', msgId), { read: true });
    } catch (err) {
      alert('Failed to mark as read: ' + err.message);
    }
  };

  const markConversationAsRead = async (buyerId) => {
    const unreadMessages = messages.filter(msg => msg.buyerId === buyerId && !msg.read && !msg.fromSeller);
    for (const msg of unreadMessages) {
      await markAsRead(msg.id);
    }
  };

  const deleteMessage = async (msgId) => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      try {
        await deleteDoc(doc(db, 'messages', msgId));
      } catch (err) {
        alert('Failed to delete message: ' + err.message);
      }
    }
  };

  const openLightbox = (images, index) => {
    setLightboxImages(images);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const totalUnread = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!sellerId) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">⚠️ {error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          <div className="border-b border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">
                {userProfiles[sellerId]?.displayName ? `${userProfiles[sellerId].displayName}'s Inbox` : 'Inbox'}
              </h1>
              {totalUnread > 0 && (
                <span className="bg-blue-600 text-white text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full">
                  {totalUnread} unread
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search messages or buyers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-3 sm:px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Messages</option>
                  <option value="unread">Unread Only</option>
                  <option value="read">Read Only</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row">
            <div className="w-full lg:w-1/3 border-b lg:border-b-0 lg:border-r border-gray-200">
              <div className="p-3 sm:p-4">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Conversations</h2>
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-6 sm:py-8">
                    <div className="text-3xl sm:text-4xl mb-4">💬</div>
                    <p className="text-sm sm:text-base text-gray-600 px-2">
                      {searchTerm || filter !== 'all' ? 'No conversations match your search.' : 'No messages yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 lg:max-h-none overflow-y-auto">
                    {filteredConversations.map(conv => (
                      <div
                        key={conv.buyerId}
                        onClick={() => {
                          setSelectedConversation(conv);
                          if (conv.unreadCount > 0) {
                            markConversationAsRead(conv.buyerId);
                          }
                        }}
                        className={`p-3 sm:p-4 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation?.buyerId === conv.buyerId
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-gray-50'
                        } ${conv.unreadCount > 0 ? 'border-l-4 border-blue-500' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm sm:text-base text-gray-900 truncate">
                            {userProfiles[conv.buyerId]?.displayName || conv.buyerId}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {conv.lastMessage?.message || 'No messages'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {conv.lastMessageTime?.toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              {selectedConversation ? (
                <div className="p-3 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-base sm:text-xl font-semibold text-gray-900 truncate">
                      Conversation with {userProfiles[selectedConversation.buyerId]?.displayName || selectedConversation.buyerId}
                    </h3>
                    <button
                      onClick={() => setReplyModal({
                        open: true,
                        buyerId: selectedConversation.buyerId,
                        originalMessageId: selectedConversation.lastMessage?.id
                      })}
                      className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base"
                    >
                      Reply
                    </button>
                  </div>

                  <div className="space-y-3 sm:space-y-4 max-h-80 sm:max-h-96 overflow-y-auto">
                    {selectedConversation.messages
                      .sort((a, b) => (a.timestamp?.toDate?.() || 0) - (b.timestamp?.toDate?.() || 0))
                      .map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.fromSeller ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs sm:max-w-sm lg:max-w-md px-3 sm:px-4 py-2 rounded-lg ${
                              msg.fromSeller
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm sm:text-base">{msg.message}</p>
                            
                            {msg.imageUrls && msg.imageUrls.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {msg.imageUrls.map((url, idx) => (
                                  <img
                                    key={idx}
                                    src={url}
                                    alt={`Attachment ${idx + 1}`}
                                    className="w-16 h-16 object-cover rounded cursor-pointer hover:opacity-80"
                                    onClick={() => openLightbox(msg.imageUrls, idx)}
                                  />
                                ))}
                              </div>
                            )}
                            
                            <div className={`text-xs mt-1 ${msg.fromSeller ? 'text-blue-200' : 'text-gray-500'}`}>
                              {msg.timestamp?.toDate?.().toLocaleString?.() || ''}
                              {!msg.fromSeller && !msg.read && (
                                <span className="ml-2 text-blue-600">●</span>
                              )}
                            </div>
                            {((msg.buyerLat && msg.buyerLng && !msg.fromSeller) || (msg.sellerLat && msg.sellerLng && msg.fromSeller)) && (
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
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-3 py-1 rounded text-xs transition-colors"
                                  title="Navigate to shared location"
                                >
                                  🧭 Navigate
                                </button>
                              </div>
                            )}
                            {!msg.fromSeller && (
                              <div className="flex gap-2 mt-2">
                                {!msg.read && (
                                  <button
                                    onClick={() => markAsRead(msg.id)}
                                    className="text-xs text-blue-300 hover:text-blue-100 underline"
                                  >
                                    Mark read
                                  </button>
                                )}
                                <button
                                  onClick={() => deleteMessage(msg.id)}
                                  className="text-xs text-red-300 hover:text-red-100 underline"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 sm:h-full">
                  <div className="text-center px-4">
                    <div className="text-4xl sm:text-6xl mb-4">📧</div>
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-sm sm:text-base text-gray-600">Choose a conversation from the list to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ReplyToBuyerModal
        open={replyModal.open}
        onClose={() => setReplyModal({ open: false, buyerId: '', originalMessageId: '' })}
        buyerId={replyModal.buyerId}
        sellerId={sellerId}
        originalMessageId={replyModal.originalMessageId}
      />

      <ImageLightbox
        isOpen={lightboxOpen}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}

export default SellerInbox;
