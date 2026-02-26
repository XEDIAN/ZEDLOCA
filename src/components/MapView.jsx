import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import MessageSellerModal from './MessageSellerModal';
import MapControls from './MapControls';
import DraggableSidebar from './DraggableSidebar';
import { trackMessageSent, trackSaveSeller, trackSearch, trackButtonClick } from '../utils/analytics';
import L from 'leaflet';
import 'leaflet.heat';

// Quick message templates
const QUICK_MESSAGES = [
  { id: 'inquiry', label: 'Ask about price', message: "Hi! I'm interested in your products. Is the price negotiable?" },
  { id: 'availability', label: 'Check availability', message: 'Hello! Are your products still available?' },
  { id: 'visit', label: 'Plan visit', message: 'Hi! What are your operating hours? I would like to visit your store.' },
];

// Custom icons
const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
  iconSize: isMobile ? [28, 28] : [38, 38],
  iconAnchor: isMobile ? [14, 28] : [19, 38],
  popupAnchor: isMobile ? [0, -28] : [0, -38],
});

const promotedIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616490.png',
  iconSize: isMobile ? [30, 30] : [42, 42],
  iconAnchor: isMobile ? [15, 30] : [21, 42],
  popupAnchor: isMobile ? [0, -30] : [0, -42],
});

const userLocationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: isMobile ? [20, 20] : [28, 28],
  iconAnchor: isMobile ? [10, 10] : [14, 14],
  popupAnchor: isMobile ? [0, -20] : [0, -28],
});

// Map style options
const MAP_STYLES = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    name: 'Standard'
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
    name: 'Light'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CartoDB',
    name: 'Dark'
  }
};

function haversine(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number')) return Infinity;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MapContent({ sellers, userLocation, onViewStore, messageModal, setMessageModal, onNavigate, onNavigateToMessages, sellerMessageStatus = {}, onSaveSeller, savedSellers = [] }) {
  const map = useMap();

  useEffect(() => {
    if (sellers.length > 0) {
      const validCoords = sellers.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  }, [sellers, map]);

  const isSellerSaved = (sellerId) => {
    return savedSellers.some(s => s.id === sellerId);
  };

  return (
    <>
      {sellers
        .filter(seller => typeof seller.lat === 'number' && typeof seller.lng === 'number')
        .map(seller => {
          const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : Infinity;
          const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;
          const icon = promoActive ? promotedIcon : sellerIcon;
          const isSaved = isSellerSaved(seller.id);

          return (
            <Marker key={seller.id} position={[seller.lat, seller.lng]} icon={icon}>
              <Popup maxWidth={320}>
                <div className="p-2">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">🏪</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{seller.displayName || 'Seller'}</h3>
                      {promoActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Promotion</span>}
                      {isSaved && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-1">⭐</span>}
                    </div>
                  </div>

                  {promoActive && seller.promo_text && (
                    <p className="text-sm text-gray-600 mb-3 italic">"{seller.promo_text}"</p>
                  )}

                  {userLocation && (
                    <p className="text-xs text-gray-500 mb-3">
                      📍 {(distanceToUser / 1000).toFixed(1)} km away
                    </p>
                  )}

                  <div className="flex flex-col gap-2">
                    <button
                      className="w-full bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                      onClick={() => onViewStore(seller.id)}
                    >
                      View Store
                    </button>
                    {seller.phone && (
                      <a
                        href={`tel:${seller.phone}`}
                        className="w-full bg-purple-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-purple-700 transition-colors text-center block"
                      >
                        📞 Call
                      </a>
                    )}
                    <button
                      className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors"
                      onClick={() => onNavigate(seller)}
                      title="Get directions to this seller"
                    >
                      🗺️ Navigate
                    </button>
                    {/* Save Seller Button */}
                    <button
                      className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
                        isSaved 
                          ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={() => onSaveSeller && onSaveSeller(seller)}
                      title={isSaved ? 'Remove from saved sellers' : 'Save seller to favorites'}
                    >
                      {isSaved ? '⭐ Saved' : '☆ Save'}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
    </>
  );
}

function HeatmapLayer({ sellers, enabled }) {
  const map = useMap();

  useEffect(() => {
    if (!enabled || !sellers.length) return;

    const heatData = sellers
      .filter(seller => typeof seller.lat === 'number' && typeof seller.lng === 'number')
      .map(seller => [seller.lat, seller.lng, 0.5]); // [lat, lng, intensity]

    const heatLayer = L.heatLayer(heatData, {
      radius: 25,
      blur: 15,
      maxZoom: 18,
      max: 1.0,
      minOpacity: 0.3,
      gradient: {
        0.2: 'blue',
        0.4: 'lime',
        0.6: 'yellow',
        0.8: 'orange',
        1.0: 'red'
      }
    });

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [sellers, enabled, map]);

  return null;
}

function MapView({ onViewStore, onBack, role, onNavigateToInbox, onNavigateToMessages }) {
  const [sellers, setSellers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [messageModal, setMessageModal] = useState({ open: false, seller: null, prefillMessage: '' });
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('distance'); // 'distance', 'name', 'rating'
  const [loading, setLoading] = useState(true);
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [sellerMessageStatus, setSellerMessageStatus] = useState({}); // Track message history per seller
  const [expandedQuickMessage, setExpandedQuickMessage] = useState(null); // Track which seller's quick messages are expanded
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0); // Total unread replies from sellers
  const [savedSellers, setSavedSellers] = useState([]); // Saved sellers list

  // Real-time tracking of unread messages from sellers (matching sidebar functionality)
  useEffect(() => {
    if (role !== 'buyer' || !auth?.currentUser?.uid) return;

    const userId = auth.currentUser.uid;

    // Fetch unread replies count (messages from sellers to this buyer)
    const repliesQuery = query(
      collection(db, 'messages'),
      where('buyerId', '==', userId),
      where('fromSeller', '==', true),
      where('read', '==', false)
    );

    const unsubReplies = onSnapshot(repliesQuery, (snapshot) => {
      setTotalUnreadMessages(snapshot.size);
    }, (err) => {
      console.error('Failed to load unread replies:', err);
      setTotalUnreadMessages(0);
    });

    return () => unsubReplies();
  }, [role, auth?.currentUser?.uid]);

  // Load saved sellers from local storage
  useEffect(() => {
    if (role === 'buyer' && auth?.currentUser?.uid) {
      const userId = auth.currentUser.uid;
      const savedKey = `savedSellers_${userId}`;
      const saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
      setSavedSellers(saved);
    }
  }, [role, auth?.currentUser?.uid]);

  // Fetch message history for all sellers (both map and list views)
  useEffect(() => {
    if (!auth?.currentUser?.uid) return;

    const fetchMessageStatus = async () => {
      const status = {};
      for (const seller of sellers) {
        try {
          const q = query(
            collection(db, 'messages'),
            where('sellerId', '==', seller.id),
            where('buyerId', '==', auth.currentUser.uid),
            limit(10)
          );
          const snapshot = await getDocs(q);
          const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const lastMessage = messages[messages.length - 1];
          const unreadFromSeller = messages.filter(m => m.fromSeller && !m.read).length;
          status[seller.id] = {
            hasMessaged: messages.length > 0,
            lastMessage: lastMessage?.message || null,
            unreadCount: unreadFromSeller,
            timestamp: lastMessage?.timestamp
          };
        } catch (err) {
          status[seller.id] = { hasMessaged: false, lastMessage: null, unreadCount: 0 };
        }
      }
      setSellerMessageStatus(status);
    };

    fetchMessageStatus();
  }, [sellers, auth?.currentUser?.uid]);

  // Handle quick message selection
  const handleQuickMessage = (seller, templateMessage) => {
    setMessageModal({ 
      open: true, 
      seller, 
      prefillMessage: templateMessage 
    });
    setExpandedQuickMessage(null);
  };

  useEffect(() => {
    setIsMounted(true);
    const unsub = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      setSellers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.log('Geolocation error:', err);
          setUserLocation(null);
        },
        { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
      );
    }
  }, []);

  const filteredAndSortedSellers = useMemo(() => {
    let filtered = sellers.filter(seller => {
      const matchesSearch = !searchTerm ||
        seller.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        seller.businessName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = selectedCategory === 'all' ||
        seller.category === selectedCategory;

      return matchesSearch && matchesCategory && typeof seller.lat === 'number' && typeof seller.lng === 'number';
    });

    // Sort sellers
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          if (!userLocation) return 0;
          const distA = haversine(userLocation.lat, userLocation.lng, a.lat, a.lng);
          const distB = haversine(userLocation.lat, userLocation.lng, b.lat, b.lng);
          return distA - distB;
        case 'name':
          return (a.displayName || '').localeCompare(b.displayName || '');
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        default:
          return 0;
      }
    });

    return filtered;
  }, [sellers, searchTerm, selectedCategory, sortBy, userLocation]);

  const categories = useMemo(() => {
    const cats = new Set(sellers.map(s => s.category).filter(Boolean));
    return ['all', ...Array.from(cats)];
  }, [sellers]);

  const handleNavigateToSeller = (seller) => {
    if (!userLocation) {
      alert('Unable to get your location. Please enable location services and try again.');
      return;
    }

    // Create Google Maps URL with directions
    const origin = `${userLocation.lat},${userLocation.lng}`;
    const destination = `${seller.lat},${seller.lng}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;

    // Open in new tab/window
    window.open(googleMapsUrl, '_blank');
  };

// Handle save seller
  const handleSaveSeller = (seller) => {
    const userId = auth?.currentUser?.uid;
    if (userId) {
      const savedKey = `savedSellers_${userId}`;
      const currentSaved = JSON.parse(localStorage.getItem(savedKey) || '[]');
      if (!currentSaved.find(s => s.id === seller.id)) {
        const newSeller = { id: seller.id, displayName: seller.displayName || 'Seller' };
        currentSaved.push(newSeller);
        localStorage.setItem(savedKey, JSON.stringify(currentSaved));
        setSavedSellers(currentSaved);
        trackSaveSeller(seller.id);
        alert('Seller saved to favorites!');
      } else {
        alert('Seller already saved!');
      }
    }
  };

  // Check if seller is saved
  const isSellerSaved = (sellerId) => {
    return savedSellers.some(s => s.id === sellerId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative bg-gray-50">
      {/* Header with Search and Controls */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white shadow-lg border-b">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-col gap-2 sm:gap-3 items-center">
            {/* Back Button and Search Row */}
            <div className="flex w-full gap-2 items-center">
              <button
                onClick={onBack}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                aria-label="Go back"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-xs sm:text-sm font-medium">Back</span>
              </button>

              {/* Search Bar */}
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search sellers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 sm:pl-10 pr-8 sm:pr-10 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg className="absolute left-2.5 sm:left-3 top-2.5 sm:top-3 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 sm:top-3 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex w-full gap-2 items-center overflow-x-auto pb-1">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-shrink-0"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All' : cat}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent flex-shrink-0"
              >
                <option value="distance">Distance</option>
                <option value="name">Name</option>
                <option value="rating">Rating</option>
              </select>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🗺️ Map
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 List
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Count and Message Status */}
      <div className="fixed top-24 sm:top-28 left-4 z-40 flex gap-2">
        <div className="bg-white px-3 py-1.5 rounded-lg shadow-md border">
          <span className="text-sm font-medium text-gray-700">
            {filteredAndSortedSellers.length} seller{filteredAndSortedSellers.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Message Status Banner for Buyers */}
        {role === 'buyer' && (totalUnreadMessages > 0 || savedSellers.length > 0) && (
          <div className="bg-white px-3 py-1.5 rounded-lg shadow-md border flex items-center gap-2">
            {totalUnreadMessages > 0 && (
              <button
                onClick={() => onNavigateToMessages && onNavigateToMessages()}
                className="flex items-center gap-1 text-sm text-green-600 hover:text-green-700 cursor-pointer"
              >
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="font-medium">{totalUnreadMessages} unread message{totalUnreadMessages > 1 ? 's' : ''}</span>
              </button>
            )}
            {savedSellers.length > 0 && (
              <span className="text-sm text-yellow-600">
                ⭐ {savedSellers.length} saved
              </span>
            )}
          </div>
        )}
      </div>

      {/* Map View */}
      {viewMode === 'map' && isMounted && (
        <div className="pt-24 sm:pt-28 h-full">
          <MapContainer
            center={[-15.417, 28.283]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapContent
              sellers={filteredAndSortedSellers}
              userLocation={userLocation}
              onViewStore={onViewStore}
              messageModal={messageModal}
              setMessageModal={setMessageModal}
              onNavigate={handleNavigateToSeller}
              onNavigateToMessages={onNavigateToMessages}
              sellerMessageStatus={sellerMessageStatus}
              onSaveSeller={handleSaveSeller}
              savedSellers={savedSellers}
            />
            <HeatmapLayer sellers={filteredAndSortedSellers} enabled={heatmapEnabled} />
            <MapControls heatmapEnabled={heatmapEnabled} onToggleHeatmap={() => setHeatmapEnabled(!heatmapEnabled)} />
          </MapContainer>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="pt-28 sm:pt-32 h-full overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-4">
            {/* Messages Summary Banner */}
            {role === 'buyer' && (
              <div className="mb-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Your Messages</h3>
                    <p className="text-blue-100 text-sm">
                      {totalUnreadMessages > 0 
                        ? `You have ${totalUnreadMessages} unread message${totalUnreadMessages > 1 ? 's' : ''} from sellers`
                        : 'No unread messages'
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigateToMessages && onNavigateToMessages()}
                    className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
                  >
                    {totalUnreadMessages > 0 ? 'View Messages' : 'All Messages'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {filteredAndSortedSellers.map(seller => {
                const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : null;
                const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;
                const msgStatus = sellerMessageStatus[seller.id] || {};
                const isSaved = isSellerSaved(seller.id);
                
                return (
                  <div key={seller.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
                    {/* Message Status Indicator */}
                    {msgStatus.hasMessaged && (
                      <div className="mb-3 flex items-center gap-2">
                        {msgStatus.unreadCount > 0 ? (
                          <span className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-2 py-1 rounded-full">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            {msgStatus.unreadCount} new reply{msgStatus.unreadCount > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            ✓ Previously messaged
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
<div className="flex items-center mb-2">
                          <span className="text-2xl mr-3">🏪</span>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{seller.displayName || 'Seller'}</h3>
                            {promoActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">Promotion</span>}
                            {isSaved && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">⭐ Saved</span>}
                          </div>
                        </div>

                        {promoActive && seller.promo_text && (
                          <p className="text-gray-600 mb-3 italic">"{seller.promo_text}"</p>
                        )}

                        <div className="flex items-center text-sm text-gray-500 mb-3">
                          {distanceToUser && (
                            <span className="mr-4">📍 {(distanceToUser / 1000).toFixed(1)} km away</span>
                          )}
                          {seller.category && (
                            <span className="bg-gray-100 px-2 py-1 rounded">{seller.category}</span>
                          )}
                        </div>
                        
                        {/* Last Message Preview */}
                        {msgStatus.lastMessage && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                            <span className="text-gray-500">Last message: </span>
                            <span className="text-gray-700 italic">"{msgStatus.lastMessage.substring(0, 50)}{msgStatus.lastMessage.length > 50 ? '...' : ''}"</span>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        <div className="flex gap-2">
                          <button
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                            onClick={() => onViewStore(seller.id)}
                          >
                            View Store
                          </button>
                          <button
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                              msgStatus.hasMessaged 
                                ? 'bg-green-600 text-white hover:bg-green-700' 
                                : 'bg-green-600 text-white hover:bg-green-700'
                            }`}
                            onClick={() => setMessageModal({ open: true, seller, prefillMessage: '' })}
                          >
                            {msgStatus.hasMessaged ? '💬 Reply' : '✉️ Message'}
                          </button>
                        </div>
                        
                        {/* Quick Message Buttons */}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {QUICK_MESSAGES.map(template => (
                            <button
                              key={template.id}
                              onClick={() => handleQuickMessage(seller, template.message)}
                              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors"
                              title={template.message}
                            >
                              {template.label}
                            </button>
                          ))}
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-1">
                          {seller.phone && (
                            <a
                              href={`tel:${seller.phone}`}
                              className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors text-center block"
                            >
                              📞 Call
                            </a>
                          )}
                          <button
                            className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                            onClick={() => handleNavigateToSeller(seller)}
                            title="Get directions to this seller"
                          >
                            🗺️ Navigate
                          </button>
                          {/* Save Seller Button */}
                          <button
                            className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSaved 
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                            onClick={() => handleSaveSeller(seller)}
                            title={isSaved ? 'Remove from saved sellers' : 'Save seller to favorites'}
                          >
                            {isSaved ? '⭐ Saved' : '☆ Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredAndSortedSellers.length === 0 && (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">No sellers found</h3>
                <p className="text-gray-600">Try adjusting your search or filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      <MessageSellerModal
        open={messageModal.open}
        onClose={() => setMessageModal({ open: false, seller: null, prefillMessage: '' })}
        sellerId={messageModal.seller?.id || ''}
        sellerName={messageModal.seller?.displayName || ''}
        buyerId={auth?.currentUser?.uid || ''}
        prefillMessage={messageModal.prefillMessage || ''}
      />

      <DraggableSidebar
        role={role}
        onNavigateToInbox={onNavigateToInbox}
        onNavigateToMessages={onNavigateToMessages}
      />
    </div>
  );
}

export default MapView;
