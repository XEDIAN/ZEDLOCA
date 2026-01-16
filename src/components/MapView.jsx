import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import MessageSellerModal from './MessageSellerModal';
import MapControls from './MapControls';
import L from 'leaflet';

// Custom icons
const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
  iconSize: isMobile ? [22, 22] : [32, 32],
  iconAnchor: isMobile ? [11, 22] : [16, 32],
  popupAnchor: isMobile ? [0, -22] : [0, -32],
});

const promotedIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616490.png',
  iconSize: isMobile ? [24, 24] : [36, 36],
  iconAnchor: isMobile ? [12, 24] : [18, 36],
  popupAnchor: isMobile ? [0, -24] : [0, -36],
});

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

function MapContent({ sellers, userLocation, onViewStore, messageModal, setMessageModal, onNavigate }) {
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

  return (
    <>
      {sellers
        .filter(seller => typeof seller.lat === 'number' && typeof seller.lng === 'number')
        .map(seller => {
          const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : Infinity;
          const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;
          const icon = promoActive ? promotedIcon : sellerIcon;

          return (
            <Marker key={seller.id} position={[seller.lat, seller.lng]} icon={icon}>
              <Popup maxWidth={300}>
                <div className="p-2">
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-2">🏪</span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{seller.displayName || 'Seller'}</h3>
                      {promoActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Promotion</span>}
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
                    <div className="flex gap-2">
                      <button
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                        onClick={() => onViewStore(seller.id)}
                      >
                        View Store
                      </button>
                      <button
                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors"
                        onClick={() => setMessageModal({ open: true, seller })}
                      >
                        Message
                      </button>
                    </div>
                    <button
                      className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors"
                      onClick={() => onNavigate(seller)}
                      title="Get directions to this seller"
                    >
                      🗺️ Navigate
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

function MapView({ onViewStore, onBack }) {
  const [sellers, setSellers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [messageModal, setMessageModal] = useState({ open: false, seller: null });
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('distance'); // 'distance', 'name', 'rating'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      <div className="absolute top-0 left-0 right-0 z-40 bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            {/* Back Button */}
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>

            {/* Search Bar */}
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search sellers or products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === 'all' ? 'All Categories' : cat}
                  </option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="distance">Distance</option>
                <option value="name">Name</option>
                <option value="rating">Rating</option>
              </select>

              {/* View Toggle */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'map' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  🗺️ Map
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
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

      {/* Results Count */}
      <div className="absolute top-20 left-4 z-30 bg-white px-3 py-2 rounded-lg shadow-sm border">
        <span className="text-sm text-gray-600">
          {filteredAndSortedSellers.length} seller{filteredAndSortedSellers.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="pt-24 h-full">
          <MapContainer
            center={[-15.417, 28.283]}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <MapContent
              sellers={filteredAndSortedSellers}
              userLocation={userLocation}
              onViewStore={onViewStore}
              messageModal={messageModal}
              setMessageModal={setMessageModal}
              onNavigate={handleNavigateToSeller}
            />
            <MapControls />
          </MapContainer>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="pt-24 h-full overflow-y-auto bg-gray-50">
          <div className="max-w-4xl mx-auto p-4">
            <div className="space-y-4">
              {filteredAndSortedSellers.map(seller => {
                const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : null;
                const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;

                return (
                  <div key={seller.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          <span className="text-2xl mr-3">🏪</span>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{seller.displayName || 'Seller'}</h3>
                            {promoActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">Promotion</span>}
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
                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                            onClick={() => setMessageModal({ open: true, seller })}
                          >
                            Message
                          </button>
                        </div>
                        <button
                          className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                          onClick={() => handleNavigateToSeller(seller)}
                          title="Get directions to this seller"
                        >
                          🗺️ Navigate
                        </button>
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
        onClose={() => setMessageModal({ open: false, seller: null })}
        sellerId={messageModal.seller?.id || ''}
        sellerName={messageModal.seller?.displayName || ''}
        buyerId={auth?.currentUser?.uid || ''}
      />
    </div>
  );
}

export default MapView;
