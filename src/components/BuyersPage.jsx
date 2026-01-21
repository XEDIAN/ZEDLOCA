import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import MessageSellerModal from './MessageSellerModal';

function BuyersPage({ sellerId, onBack, onViewBuyerOrders }) {
  const [buyers, setBuyers] = useState([]);
  const [filteredBuyers, setFilteredBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buyerIds, setBuyerIds] = useState([]);
  const [userProfiles, setUserProfiles] = useState({});
  const [sellerLocation, setSellerLocation] = useState(null);
  const [analytics, setAnalytics] = useState({
    totalBuyers: 0,
    activeBuyers: 0,
    totalMessages: 0,
    totalOrders: 0,
    avgResponseTime: 0
  });

  // Filters and sorting
  const [filters, setFilters] = useState({
    search: '',
    activityLevel: 'all', // all, active, inactive
    sortBy: 'recent', // recent, orders, messages
    sortOrder: 'desc'
  });

  // Modal states
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Fetch seller location
  useEffect(() => {
    if (!sellerId) return;

    const fetchSellerLocation = async () => {
      try {
        const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
        if (sellerDoc.exists()) {
          const sellerData = sellerDoc.data();
          setSellerLocation({ lat: sellerData.lat, lng: sellerData.lng });
        }
      } catch (error) {
        console.error('Error fetching seller location:', error);
      }
    };

    fetchSellerLocation();
  }, [sellerId]);

  // Load buyers data
  useEffect(() => {
    if (!sellerId) return;

    setLoading(true);

    // Query all buyers
    const buyersQuery = collection(db, 'buyers');

    // Query messages for buyer interactions
    const messagesQuery = query(
      collection(db, 'messages'),
      where('sellerId', '==', sellerId),
      orderBy('timestamp', 'desc')
    );

    // Query orders for buyer purchase history
    const ordersQuery = query(
      collection(db, 'orders'),
      where('sellerId', '==', sellerId)
    );

    const unsubBuyers = onSnapshot(buyersQuery, (buyersSnapshot) => {
      const allBuyers = {};
      buyersSnapshot.docs.forEach(doc => {
        const buyerData = doc.data();
        allBuyers[doc.id] = {
          id: doc.id,
          displayName: buyerData.displayName || buyerData.name || buyerData.email || doc.id,
          email: buyerData.email || '',
          lat: buyerData.lat || null,
          lng: buyerData.lng || null,
          messages: [],
          orders: [],
          lastInteraction: null,
          totalMessages: 0,
          totalOrders: 0,
          isActive: false
        };
      });

      // Now merge interaction data
      const unsubMessages = onSnapshot(messagesQuery, (messagesSnapshot) => {
        const uniqueBuyerIds = new Set();
        let totalMessages = 0;

        messagesSnapshot.docs.forEach(doc => {
          const msg = doc.data();
          totalMessages++;
          uniqueBuyerIds.add(msg.buyerId);

          if (!allBuyers[msg.buyerId]) {
            // If buyer not in allBuyers, add them (though unlikely)
            allBuyers[msg.buyerId] = {
              id: msg.buyerId,
              displayName: msg.buyerId,
              lat: msg.buyerLat || null,
              lng: msg.buyerLng || null,
              messages: [],
              orders: [],
              lastInteraction: msg.timestamp,
              totalMessages: 0,
              totalOrders: 0,
              isActive: false
            };
          }

          allBuyers[msg.buyerId].messages.push(msg);
          allBuyers[msg.buyerId].totalMessages++;
          allBuyers[msg.buyerId].lastInteraction = msg.timestamp;

          // Check if active (interacted in last 30 days)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (msg.timestamp?.toDate() > thirtyDaysAgo) {
            allBuyers[msg.buyerId].isActive = true;
          }
        });

        // Set buyer IDs for profile loading (though now we have all buyers)
        setBuyerIds(Object.keys(allBuyers));

        // Convert to array and calculate analytics
        const buyersArray = Object.values(allBuyers);
        setBuyers(buyersArray);
        setFilteredBuyers(buyersArray);

        setAnalytics(prev => ({
          ...prev,
          totalBuyers: buyersArray.length,
          activeBuyers: buyersArray.filter(b => b.isActive).length,
          totalMessages
        }));

        setLoading(false);
      });

      const unsubOrders = onSnapshot(ordersQuery, (ordersSnapshot) => {
        const orderData = {};
        ordersSnapshot.docs.forEach(doc => {
          const order = doc.data();
          if (!orderData[order.buyerId]) {
            orderData[order.buyerId] = [];
          }
          orderData[order.buyerId].push(order);
        });

        setBuyers(prev => prev.map(buyer => ({
          ...buyer,
          orders: orderData[buyer.id] || [],
          totalOrders: (orderData[buyer.id] || []).length
        })));

        const totalOrders = Object.values(orderData).reduce((sum, orders) => sum + orders.length, 0);
        setAnalytics(prev => ({ ...prev, totalOrders }));
      });

      return () => {
        unsubMessages();
        unsubOrders();
      };
    });

    return () => {
      unsubBuyers();
    };
  }, [sellerId]);

  // Load user profiles for real names
  useEffect(() => {
    if (buyerIds.length === 0) return;

    const loadUserProfiles = async () => {
      const profiles = {};
      for (const buyerId of buyerIds) {
        try {
          const userRef = doc(db, 'users', buyerId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            profiles[buyerId] = {
              displayName: userData.displayName || userData.name || userData.email || buyerId,
              email: userData.email || '',
              lat: userData.lat || null,
              lng: userData.lng || null
            };
          } else {
            profiles[buyerId] = {
              displayName: buyerId,
              email: '',
              lat: null,
              lng: null
            };
          }
        } catch (error) {
          console.error('Error loading user profile for', buyerId, error);
          profiles[buyerId] = {
            displayName: buyerId,
            email: '',
            lat: null,
            lng: null
          };
        }
      }
      setUserProfiles(profiles);
    };

    loadUserProfiles();
  }, [buyerIds]);

  // Update buyers with real names and location data
  useEffect(() => {
    if (Object.keys(userProfiles).length === 0) return;

    setBuyers(prev => prev.map(buyer => {
      const profile = userProfiles[buyer.id];
      if (profile) {
        return {
          ...buyer,
          displayName: profile.displayName,
          email: profile.email,
          // Merge location data: prefer profile location, fallback to message location
          lat: profile.lat || buyer.lat,
          lng: profile.lng || buyer.lng
        };
      }
      return buyer;
    }));
  }, [userProfiles]);

  // Apply filters and sorting
  useEffect(() => {
    let filtered = [...buyers];

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(buyer =>
        buyer.displayName.toLowerCase().includes(filters.search.toLowerCase()) ||
        buyer.messages.some(msg => msg.message.toLowerCase().includes(filters.search.toLowerCase()))
      );
    }



    // Activity filter
    if (filters.activityLevel === 'active') {
      filtered = filtered.filter(buyer => buyer.isActive);
    } else if (filters.activityLevel === 'inactive') {
      filtered = filtered.filter(buyer => !buyer.isActive);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (filters.sortBy) {
        case 'recent':
          aValue = a.lastInteraction?.toMillis?.() || 0;
          bValue = b.lastInteraction?.toMillis?.() || 0;
          break;
        case 'distance':
          if (sellerLocation && a.lat && b.lat) {
            aValue = haversine(sellerLocation.lat, sellerLocation.lng, a.lat, a.lng);
            bValue = haversine(sellerLocation.lat, sellerLocation.lng, b.lat, b.lng);
          } else {
            aValue = 0;
            bValue = 0;
          }
          break;
        case 'orders':
          aValue = a.totalOrders;
          bValue = b.totalOrders;
          break;
        case 'messages':
          aValue = a.totalMessages;
          bValue = b.totalMessages;
          break;
        default:
          aValue = 0;
          bValue = 0;
      }

      if (filters.sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    setFilteredBuyers(filtered);
  }, [buyers, filters]);

  const handleNavigateToBuyer = (buyer) => {
    if (!buyer.lat || !buyer.lng) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const origin = `${pos.coords.latitude},${pos.coords.longitude}`;
          const destination = `${buyer.lat},${buyer.lng}`;
          const url = `https://www.google.com/maps/dir/${origin}/${destination}`;
          window.open(url, '_blank');
        },
        () => {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${buyer.lat},${buyer.lng}`;
          window.open(url, '_blank');
        }
      );
    }
  };

  const handleMessageBuyer = (buyer) => {
    setSelectedBuyer(buyer);
    setShowMessageModal(true);
  };

  const handleViewBuyerOrders = (buyer) => {
    if (onViewBuyerOrders) {
      onViewBuyerOrders(buyer.id);
    }
  };

  const handleViewBuyerStore = (buyer) => {
    // Navigate to buyer's "store" - could be their profile or orders
    if (onViewBuyerOrders) {
      onViewBuyerOrders(buyer.id);
    }
  };

  const getActivityStatus = (buyer) => {
    if (!buyer.lastInteraction) return 'Never';
    const days = Math.floor((new Date() - buyer.lastInteraction.toDate()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading buyers data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Buyers</h1>
              <p className="text-blue-100 mt-1">Manage and analyze your customer base</p>
            </div>
            <button
              onClick={onBack}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Analytics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="text-gray-600 text-sm font-medium mb-2">Total Buyers</div>
            <div className="text-3xl font-bold text-gray-800">{analytics.totalBuyers}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="text-gray-600 text-sm font-medium mb-2">Active (30d)</div>
            <div className="text-3xl font-bold text-green-600">{analytics.activeBuyers}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="text-gray-600 text-sm font-medium mb-2">Total Messages</div>
            <div className="text-3xl font-bold text-blue-600">{analytics.totalMessages}</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all duration-300">
            <div className="text-gray-600 text-sm font-medium mb-2">Total Orders</div>
            <div className="text-3xl font-bold text-purple-600">{analytics.totalOrders}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search buyers..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-gray-50 text-gray-900 placeholder-gray-500 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <select
              value={filters.activityLevel}
              onChange={(e) => setFilters(prev => ({ ...prev, activityLevel: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Buyers</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            <select
              value={filters.sortBy}
              onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-gray-50 text-gray-900 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="recent">Sort by Recent</option>
              <option value="orders">Sort by Orders</option>
              <option value="messages">Sort by Messages</option>
            </select>
          </div>
        </div>

        {/* List View */}
        <div className="space-y-4">
          {filteredBuyers.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
              <p className="text-black text-lg">No buyers found matching your criteria.</p>
            </div>
          ) : (
            filteredBuyers.map(buyer => (
              <div key={buyer.id} className="bg-white rounded-lg p-6 border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-black">{buyer.displayName}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        buyer.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {buyer.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-gray-600 text-sm">Last Active</div>
                        <div className="text-black font-medium">{getActivityStatus(buyer)}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm">Messages</div>
                        <div className="text-black font-medium">{buyer.totalMessages}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm">Orders</div>
                        <div className="text-black font-medium">{buyer.totalOrders}</div>
                      </div>
                      <div>
                        <div className="text-gray-600 text-sm">Location</div>
                        <div className="text-black font-medium">
                          {buyer.lat && buyer.lng ? '📍 Available' : '📍 Unknown'}
                        </div>
                      </div>
                    </div>

                    {buyer.messages[0] && (
                      <div className="mb-4">
                        <div className="text-gray-600 text-sm mb-1">Latest Message</div>
                        <p className="text-gray-800 italic">
                          "{buyer.messages[0].message.substring(0, 100)}..."
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleMessageBuyer(buyer)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                      title="Send message"
                    >
                      💬
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Message Modal */}
      {showMessageModal && selectedBuyer && (
        <MessageSellerModal
          open={showMessageModal}
          onClose={() => {
            setShowMessageModal(false);
            setSelectedBuyer(null);
          }}
          sellerId={sellerId}
          sellerName={auth.currentUser?.displayName || 'Seller'}
          buyerId={selectedBuyer.id}
        />
      )}
    </div>
  );
}



export default BuyersPage;
