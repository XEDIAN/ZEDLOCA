import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import L from 'leaflet';
import MessageSellerModal from './MessageSellerModal';

// Custom icons
const buyerIcon = L.divIcon({
  html: `<div style="
    background-color: #ef4444;
    border: 2px solid white;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 12px;
    color: white;
    font-weight: bold;
  ">👤</div>`,
  className: 'custom-buyer-marker',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const sellerIcon = L.divIcon({
  html: `<div style="
    background-color: #10b981;
    border: 2px solid white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 14px;
    color: white;
    font-weight: bold;
  ">🏪</div>`,
  className: 'custom-seller-marker',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function MapController({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, zoom || 13);
    }
  }, [center, zoom, map]);

  return null;
}

function BuyersPage({ sellerId, onBack }) {
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [buyers, setBuyers] = useState([]);
  const [filteredBuyers, setFilteredBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
    radius: 50000, // max radius
    activityLevel: 'all', // all, active, inactive
    sortBy: 'recent', // recent, distance, orders, messages
    sortOrder: 'desc'
  });

  // Modal states
  const [selectedBuyer, setSelectedBuyer] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  // Load seller location
  useEffect(() => {
    if (!sellerId) return;

    const loadSellerLocation = async () => {
      try {
        const sellerRef = doc(db, 'sellers', sellerId);
        const sellerSnap = await getDoc(sellerRef);
        if (sellerSnap.exists()) {
          const data = sellerSnap.data();
          if (data.lat && data.lng) {
            setSellerLocation({ lat: data.lat, lng: data.lng });
          }
        }
      } catch (err) {
        console.error('Error loading seller location:', err);
      }
    };

    loadSellerLocation();
  }, [sellerId]);

  // Load buyers data
  useEffect(() => {
    if (!sellerId) return;

    setLoading(true);

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

    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      const buyerData = {};
      let totalMessages = 0;

      snapshot.docs.forEach(doc => {
        const msg = doc.data();
        totalMessages++;

        if (!buyerData[msg.buyerId]) {
          buyerData[msg.buyerId] = {
            id: msg.buyerId,
            displayName: msg.buyerId, // Could be enhanced with user profile
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

        buyerData[msg.buyerId].messages.push(msg);
        buyerData[msg.buyerId].totalMessages++;
        buyerData[msg.buyerId].lastInteraction = msg.timestamp;

        // Check if active (interacted in last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (msg.timestamp?.toDate() > thirtyDaysAgo) {
          buyerData[msg.buyerId].isActive = true;
        }
      });

      // Convert to array and calculate analytics
      const buyersArray = Object.values(buyerData);
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

    const unsubOrders = onSnapshot(ordersQuery, (snapshot) => {
      const orderData = {};
      snapshot.docs.forEach(doc => {
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
  }, [sellerId]);

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

    // Radius filter
    if (sellerLocation && filters.radius < 50000) {
      filtered = filtered.filter(buyer => {
        if (!buyer.lat || !buyer.lng) return false;
        const distance = haversine(sellerLocation.lat, sellerLocation.lng, buyer.lat, buyer.lng);
        return distance <= filters.radius;
      });
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
  }, [buyers, filters, sellerLocation]);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">My Buyers</h1>
              <p className="text-white/80">Manage and analyze your customer base</p>
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
            <div className="text-white/60 text-sm">Total Buyers</div>
            <div className="text-2xl font-bold text-white">{analytics.totalBuyers}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
            <div className="text-white/60 text-sm">Active (30d)</div>
            <div className="text-2xl font-bold text-green-300">{analytics.activeBuyers}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
            <div className="text-white/60 text-sm">Total Messages</div>
            <div className="text-2xl font-bold text-blue-300">{analytics.totalMessages}</div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
            <div className="text-white/60 text-sm">Total Orders</div>
            <div className="text-2xl font-bold text-purple-300">{analytics.totalOrders}</div>
          </div>
        </div>

        {/* View Toggle and Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* View Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('map')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'map'
                    ? 'bg-white text-gray-800'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                🗺️ Map View
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-800'
                    : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                📋 List View
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search buyers..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              />

              <select
                value={filters.activityLevel}
                onChange={(e) => setFilters(prev => ({ ...prev, activityLevel: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="all">All Buyers</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>

              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                className="px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="recent">Sort by Recent</option>
                <option value="distance">Sort by Distance</option>
                <option value="orders">Sort by Orders</option>
                <option value="messages">Sort by Messages</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === 'map' ? (
          <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
            <div className="h-[600px]">
              <MapContainer
                center={sellerLocation || [51.505, -0.09]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <MapController center={sellerLocation} zoom={13} />

                {/* Seller marker */}
                {sellerLocation && (
                  <Marker position={[sellerLocation.lat, sellerLocation.lng]} icon={sellerIcon}>
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-semibold">Your Store</h3>
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Buyer markers */}
                {filteredBuyers.map(buyer => (
                  buyer.lat && buyer.lng && (
                    <Marker
                      key={buyer.id}
                      position={[buyer.lat, buyer.lng]}
                      icon={buyerIcon}
                    >
                      <Popup>
                        <div className="p-3 min-w-[250px]">
                          <h3 className="font-semibold text-gray-800 mb-2">{buyer.displayName}</h3>
                          <div className="space-y-1 text-sm text-gray-600 mb-3">
                            <p>Last active: {getActivityStatus(buyer)}</p>
                            <p>{buyer.totalMessages} messages, {buyer.totalOrders} orders</p>
                            {buyer.messages[0] && (
                              <p className="text-xs italic">
                                "{buyer.messages[0].message.substring(0, 50)}..."
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleNavigateToBuyer(buyer)}
                              className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                            >
                              🧭 Navigate
                            </button>
                            <button
                              onClick={() => handleMessageBuyer(buyer)}
                              className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors"
                            >
                              💬 Message
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )
                ))}
              </MapContainer>
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {filteredBuyers.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 text-center border border-white/20">
                <p className="text-white text-lg">No buyers found matching your criteria.</p>
              </div>
            ) : (
              filteredBuyers.map(buyer => (
                <div key={buyer.id} className="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-white">{buyer.displayName}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          buyer.isActive
                            ? 'bg-green-500/20 text-green-300'
                            : 'bg-gray-500/20 text-gray-300'
                        }`}>
                          {buyer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-white/60 text-sm">Last Active</div>
                          <div className="text-white font-medium">{getActivityStatus(buyer)}</div>
                        </div>
                        <div>
                          <div className="text-white/60 text-sm">Messages</div>
                          <div className="text-white font-medium">{buyer.totalMessages}</div>
                        </div>
                        <div>
                          <div className="text-white/60 text-sm">Orders</div>
                          <div className="text-white font-medium">{buyer.totalOrders}</div>
                        </div>
                        <div>
                          <div className="text-white/60 text-sm">Location</div>
                          <div className="text-white font-medium">
                            {buyer.lat && buyer.lng ? '📍 Available' : '📍 Unknown'}
                          </div>
                        </div>
                      </div>

                      {buyer.messages[0] && (
                        <div className="mb-4">
                          <div className="text-white/60 text-sm mb-1">Latest Message</div>
                          <p className="text-white/80 italic">
                            "{buyer.messages[0].message.substring(0, 100)}..."
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {buyer.lat && buyer.lng && (
                        <button
                          onClick={() => handleNavigateToBuyer(buyer)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                          title="Navigate to buyer"
                        >
                          🧭
                        </button>
                      )}
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
        )}
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

// Haversine distance calculation
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000; // earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default BuyersPage;
