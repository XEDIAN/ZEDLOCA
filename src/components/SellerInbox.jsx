import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import ReplyToBuyerModal from './ReplyToBuyerModal';

function SellerInbox({ sellerId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyModal, setReplyModal] = useState({ open: false, buyerId: '', originalMessageId: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [userProfiles, setUserProfiles] = useState({});

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

  // Load user profiles for all unique user IDs in messages
  useEffect(() => {
    if (messages.length === 0) return;

    const uniqueUserIds = new Set();
    messages.forEach(msg => {
      uniqueUserIds.add(msg.buyerId);
    });
    uniqueUserIds.add(sellerId); // Include seller

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

  // Group messages by buyer for conversation view
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

    // Sort conversations by last message time
    return Object.values(grouped).sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  }, [messages]);

  // Filter conversations based on search and filter
  const filteredConversations = useMemo(() => {
    return conversations.filter(conv => {
      const buyerName = userProfiles[conv.buyerId]?.displayName || conv.buyerId;
      const matchesSearch = searchTerm === '' ||
        buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.buyerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.messages.some(msg => msg.message.toLowerCase().includes(searchTerm.toLowerCase()));

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {userProfiles[sellerId]?.displayName ? `${userProfiles[sellerId].displayName}'s Inbox` : 'Inbox'}
              </h1>
              {totalUnread > 0 && (
                <span className="bg-blue-600 text-white text-sm px-3 py-1 rounded-full">
                  {totalUnread} unread
                </span>
              )}
            </div>

            {/* Search and Filter */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Search messages or buyers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Messages</option>
                  <option value="unread">Unread Only</option>
                  <option value="read">Read Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex">
            {/* Conversations List */}
            <div className="w-full md:w-1/3 border-r border-gray-200">
              <div className="p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversations</h2>
                {filteredConversations.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-gray-600">
                      {searchTerm || filter !== 'all' ? 'No conversations match your search.' : 'No messages yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredConversations.map(conv => (
                      <div
                        key={conv.buyerId}
                        onClick={() => {
                          setSelectedConversation(conv);
                          if (conv.unreadCount > 0) {
                            markConversationAsRead(conv.buyerId);
                          }
                        }}
                        className={`p-4 rounded-lg cursor-pointer transition-colors ${
                          selectedConversation?.buyerId === conv.buyerId
                            ? 'bg-blue-50 border-blue-200'
                            : 'hover:bg-gray-50'
                        } ${conv.unreadCount > 0 ? 'border-l-4 border-blue-500' : ''}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">
                            {userProfiles[conv.buyerId]?.displayName || conv.buyerId}
                          </span>
                          {conv.unreadCount > 0 && (
                            <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">
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

            {/* Messages View */}
            <div className="flex-1">
              {selectedConversation ? (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-semibold text-gray-900">
                      Conversation with {userProfiles[selectedConversation.buyerId]?.displayName || selectedConversation.buyerId}
                    </h3>
                    <button
                      onClick={() => setReplyModal({
                        open: true,
                        buyerId: selectedConversation.buyerId,
                        originalMessageId: selectedConversation.lastMessage?.id
                      })}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Reply
                    </button>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {selectedConversation.messages
                      .sort((a, b) => (a.timestamp?.toDate?.() || 0) - (b.timestamp?.toDate?.() || 0))
                      .map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.fromSeller ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.fromSeller
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{msg.message}</p>
                            <div className={`text-xs mt-1 ${msg.fromSeller ? 'text-blue-200' : 'text-gray-500'}`}>
                              {msg.timestamp?.toDate?.().toLocaleString?.() || ''}
                              {!msg.fromSeller && !msg.read && (
                                <span className="ml-2 text-blue-600">●</span>
                              )}
                            </div>
                            {msg.buyerLat && msg.buyerLng && !msg.fromSeller && (
                              <div className="mt-2">
                                <button
                                  onClick={() => {
                                    if (navigator.geolocation) {
                                      navigator.geolocation.getCurrentPosition(
                                        (pos) => {
                                          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
                                          const destination = `${msg.buyerLat},${msg.buyerLng}`;
                                          const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
                                          window.open(url, '_blank');
                                        },
                                        () => {
                                          const url = `https://www.google.com/maps/dir/?api=1&destination=${msg.buyerLat},${msg.buyerLng}`;
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
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📧</div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">Select a conversation</h3>
                    <p className="text-gray-600">Choose a conversation from the list to view messages</p>
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
    </div>
  );
}

export default SellerInbox;
