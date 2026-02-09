import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';

/**
 * Simple haversine implementation to compute distances in meters.
 */
function haversine(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number')) return Infinity;
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

function BuyerStores({ onViewSeller, onBack, onMessageSeller, onPlaceOrder, onNavigateToPlaceOrder, user, role }) {
  console.log('BuyerStores: Component rendering');
  const { formatPrice } = useCurrency();
  console.log('BuyerStores: Currency context loaded');
  const [listings, setListings] = useState([]);
  const [sellers, setSellers] = useState({});
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [viewingSellerId, setViewingSellerId] = useState(null);
  const [sellerListings, setSellerListings] = useState([]);
  const [sellerLoading, setSellerLoading] = useState(false);

  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [distanceFilter, setDistanceFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [recentlyViewed, setRecentlyViewed] = useState([]);

  const itemsPerPage = 12;

  // Fetch listings
  useEffect(() => {
    const q = query(collection(db, 'listings'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort newest first in memory to avoid requiring composite index
      docs.sort((a, b) => new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt));
      setListings(docs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching listings:', error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch seller data for all listings
  useEffect(() => {
    const fetchSellers = async () => {
      const uniqueSellerIds = [...new Set(listings.map(l => l.userId))];
      const sellerPromises = uniqueSellerIds.map(async (sellerId) => {
        try {
          const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
          if (sellerDoc.exists()) {
            return { id: sellerId, ...sellerDoc.data() };
          }
        } catch (err) {
          console.error('Error fetching seller:', err);
        }
        return null;
      });

      const sellerData = await Promise.all(sellerPromises);
      const sellerMap = {};
      sellerData.filter(Boolean).forEach(seller => {
        sellerMap[seller.id] = seller;
      });
      setSellers(sellerMap);
    };

    if (listings.length > 0) {
      fetchSellers();
    }
  }, [listings]);

  // Get user location
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          console.warn('User location not available:', err.message);
          setUserLocation(null);
        },
        { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
      );
    } else {
      setUserLocation(null);
    }
    return () => { cancelled = true; };
  }, []);

  // Load favorites from localStorage
  useEffect(() => {
    const savedFavorites = localStorage.getItem('buyerFavorites');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem('buyerFavorites', JSON.stringify([...favorites]));
  }, [favorites]);

  // Load recently viewed from localStorage
  useEffect(() => {
    const savedRecentlyViewed = localStorage.getItem('recentlyViewed');
    if (savedRecentlyViewed) {
      setRecentlyViewed(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Helper functions
  const toggleFavorite = (listingId) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(listingId)) {
        newFavorites.delete(listingId);
      } else {
        newFavorites.add(listingId);
      }
      return newFavorites;
    });
  };

  const addToRecentlyViewed = (listing) => {
    const updated = [listing, ...recentlyViewed.filter(l => l.id !== listing.id)].slice(0, 10);
    setRecentlyViewed(updated);
    localStorage.setItem('recentlyViewed', JSON.stringify(updated));
  };

  const handleViewSeller = async (sellerId) => {
    console.log('BuyerStores: handleViewSeller called with sellerId:', sellerId);
    setViewingSellerId(sellerId);
    setSellerLoading(true);

    try {
      // Fetch seller's listings
      const q = query(
        collection(db, 'listings'),
        where('userId', '==', sellerId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const sellerListingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellerListings(sellerListingsData);
    } catch (error) {
      console.error('Error fetching seller listings:', error);
      setSellerListings([]);
    } finally {
      setSellerLoading(false);
    }
  };

  const handleBackToStores = () => {
    setViewingSellerId(null);
    setSellerListings([]);
  };

  const handleMessageSeller = (seller) => {
    onMessageSeller(seller);
  };

  const handleNavigateToSeller = (seller) => {
    if (!userLocation) {
      alert('Unable to get your location. Please enable location services and try again.');
      return;
    }

    if (!seller || !seller.lat || !seller.lng) {
      alert('Seller location not available.');
      return;
    }

    // Create Google Maps URL with directions
    const origin = `${userLocation.lat},${userLocation.lng}`;
    const destination = `${seller.lat},${seller.lng}`;
    const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;

    // Open in new tab/window
    window.open(googleMapsUrl, '_blank');
  };

  // Categories available
  const categories = ['electronics', 'clothing', 'home', 'sports', 'books', 'other'];

  // Filter and sort listings - by default, show ALL listings without any restrictions
  // Filters are only applied when users actively set them (optional filtering)
  const filteredListings = listings.filter(listing => {
    const seller = sellers[listing.userId];

    // Search filter (only apply if user has entered search term)
    const matchesSearch = searchTerm === '' ||
      listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (seller && (seller.storeName || seller.displayName).toLowerCase().includes(searchTerm.toLowerCase()));

    // Category filter (only apply if user has selected categories)
    const matchesCategory = selectedCategories.size === 0 || selectedCategories.has(listing.category);

    // Price filter (only apply if user has set price range)
    const price = parseFloat(listing.price.replace(/[^0-9.-]+/g, ''));
    const matchesPrice = (priceRange.min === '' || price >= parseFloat(priceRange.min)) &&
                        (priceRange.max === '' || price <= parseFloat(priceRange.max));

    // Distance filter (only apply if user has set distance filter AND has location)
    let matchesDistance = true;
    if (distanceFilter && userLocation && seller && seller.lat && seller.lng) {
      const distance = haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng);
      const maxDistance = parseFloat(distanceFilter) * 1000; // Convert km to meters
      matchesDistance = distance <= maxDistance;
    }

    return matchesSearch && matchesCategory && matchesPrice && matchesDistance;
  });

  const sortedListings = [...filteredListings].sort((a, b) => {
    const sellerA = sellers[a.userId];
    const sellerB = sellers[b.userId];

    if (sortBy === 'price-low') {
      return parseFloat(a.price.replace(/[^0-9.-]+/g, '')) - parseFloat(b.price.replace(/[^0-9.-]+/g, ''));
    }
    if (sortBy === 'price-high') {
      return parseFloat(b.price.replace(/[^0-9.-]+/g, '')) - parseFloat(a.price.replace(/[^0-9.-]+/g, ''));
    }
    if (sortBy === 'newest') {
      return new Date(b.createdAt?.toDate?.() || b.createdAt) - new Date(a.createdAt?.toDate?.() || a.createdAt);
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt?.toDate?.() || a.createdAt) - new Date(b.createdAt?.toDate?.() || b.createdAt);
    }
    if (sortBy === 'distance' && userLocation) {
      const distA = sellerA && sellerA.lat ? haversine(userLocation.lat, userLocation.lng, sellerA.lat, sellerA.lng) : Infinity;
      const distB = sellerB && sellerB.lat ? haversine(userLocation.lat, userLocation.lng, sellerB.lat, sellerB.lng) : Infinity;
      return distA - distB;
    }
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedListings.length / itemsPerPage);
  const paginatedListings = sortedListings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategories, priceRange, distanceFilter, sortBy]);

  // Loading Skeleton Component
  const LoadingSkeleton = () => (
    <div className="bg-white rounded-xl p-6 shadow-xl border border-gray-100 animate-pulse">
      <div className="mb-4 flex gap-2">
        <div className="w-20 h-20 bg-gray-200 rounded"></div>
        <div className="w-20 h-20 bg-gray-200 rounded"></div>
        <div className="w-20 h-20 bg-gray-200 rounded"></div>
      </div>
      <div className="h-6 bg-gray-200 rounded mb-2"></div>
      <div className="h-5 bg-gray-200 rounded mb-2 w-1/3"></div>
      <div className="h-4 bg-gray-200 rounded mb-1"></div>
      <div className="h-4 bg-gray-200 rounded mb-1 w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/4 mt-2"></div>
      <div className="mt-4 h-10 bg-gray-200 rounded-lg"></div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <div className="w-full max-w-6xl mt-8 px-4">
            <div className="h-12 bg-gray-200 rounded mb-6 w-64 mx-auto animate-pulse"></div>
            <div className="bg-white rounded-xl p-6 shadow-xl mb-6 border border-gray-100 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded-lg"></div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <LoadingSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>

        <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 text-white py-6 flex justify-center gap-4 z-50 shadow-2xl">
          <div className="h-12 bg-gray-600 rounded-lg w-48"></div>
        </footer>
      </div>
    );
  }

  // Render seller store view if viewing a specific seller
  if (viewingSellerId) {
    const seller = sellers[viewingSellerId];
    const distanceToSeller = seller && userLocation && typeof seller.lat === 'number' && typeof seller.lng === 'number'
      ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng)
      : Infinity;
    const promoActiveForUser = seller && seller.promo_active && typeof seller.promo_radius_meters === 'number'
      ? distanceToSeller <= seller.promo_radius_meters
      : false;
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          {/* Seller Header */}
          <div className="w-full max-w-6xl mt-8 px-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleBackToStores}
                  className="bg-white text-gray-700 px-4 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
                >
                  <span className="text-lg">⬅️</span>
                  Back to All Stores
                </button>
                <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
                  <span className="text-4xl">🏪</span>
                  {seller?.storeName || seller?.displayName || 'Seller'}'s Store
                </h1>
              </div>
              <div className="flex gap-4 text-white">
                <div className="text-center">
                  <div className="text-2xl font-bold">{sellerListings.length}</div>
                  <div className="text-sm">Listings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{favorites.size}</div>
                  <div className="text-sm">Favorites</div>
                </div>
              </div>
            </div>

            {/* Seller Info */}
            {seller && (
              <div className="bg-white rounded-xl p-6 shadow-xl mb-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    {seller.photoURL ? (
                      <img
                        src={seller.photoURL}
                        alt={seller.displayName}
                        className="w-16 h-16 rounded-full border-4 border-teal-400"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-r from-teal-400 to-purple-500 flex items-center justify-center">
                        <span className="text-2xl text-white font-bold">
                          {seller.displayName?.charAt(0)?.toUpperCase() || 'S'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-gray-800">{seller.storeName || seller.displayName}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-lg">⭐</span>
                      ))}
                      <span className="text-gray-600">(4.8)</span>
                    </div>
                    {seller.description && (
                      <p className="text-gray-600 mt-2">{seller.description}</p>
                    )}
                    {seller.phone && (
                      <p className="text-gray-600 mt-1">📞 {seller.phone}</p>
                    )}
                    {/* If promo is active and user is within radius, show promo text */}
                    {seller.promo_active && seller.promo_text && promoActiveForUser && (
                      <div className="bg-green-50 border border-green-200 rounded p-2 mt-3">
                        <p className="text-green-800 font-semibold text-sm">Special Offer:</p>
                        <p className="text-green-700 text-sm">{seller.promo_text}</p>
                        <p className="text-xs text-green-600 mt-1">Available within {seller.promo_radius_meters} meters</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {user && role === 'buyer' && (
                      <button
                        onClick={() => handleMessageSeller({ id: seller.id, displayName: seller.displayName, seller, listing: null })}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                      >
                        <span className="text-lg">💬</span>
                        Contact Seller
                      </button>
                    )}
                    <button
                      onClick={() => handleNavigateToSeller(seller)}
                      className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                      title="Get directions to this seller"
                    >
                      <span className="text-lg">🗺️</span>
                      Navigate
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seller Listings */}
          {sellerLoading ? (
            <div className="w-full max-w-6xl px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <LoadingSkeleton key={i} />
                ))}
              </div>
            </div>
          ) : sellerListings.length > 0 ? (
            <div className="w-full max-w-6xl px-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sellerListings.map(listing => (
                  <div key={listing.id} className="relative bg-white rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                    {/* Favorite Button */}
                    <button
                      onClick={() => toggleFavorite(listing.id)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow"
                      aria-label={favorites.has(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <span className="text-xl">{favorites.has(listing.id) ? '❤️' : '🤍'}</span>
                    </button>

                    {/* Images */}
                    {listing.images && listing.images.length > 0 && (
                      <div className="mb-4 flex gap-2 overflow-x-auto rounded-lg p-2 bg-gray-50">
                        {listing.images.slice(0, 4).map((img, idx) => (
                          <img key={idx} src={img} alt={`Listing ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg shadow-sm" />
                        ))}
                      </div>
                    )}

                    {/* Listing Details */}
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-xl">🏷️</span>
                        {listing.title}
                      </h4>
                      <p className="text-green-600 font-bold text-xl mb-2">{formatPrice(listing.price)}</p>
                      <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3">{listing.description}</p>

                      {/* Category Badge */}
                      {listing.category && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mb-3">
                          {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                        </span>
                      )}

                      {/* Promotion Badge and Text */}
                      {promoActiveForUser && seller.promo_text && (
                        <div className="bg-green-50 border border-green-200 rounded p-2 mb-3">
                          <p className="text-green-800 text-sm font-semibold">Special Offer:</p>
                          <p className="text-green-700 text-sm">{seller.promo_text}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl text-center">
              <span className="text-6xl mb-4 block">📦</span>
              <p className="text-white text-lg mb-2">No listings available from this seller.</p>
              <p className="text-white text-sm">Check back later for new items.</p>
            </div>
          )}
      </div>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 text-white py-6 flex justify-center gap-4 z-50 shadow-2xl">
        <button
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          onClick={onBack}
        >
          <span className="text-xl">⬅️</span>
          Back to Map
        </button>
      </footer>


    </div>
  );
}

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
      <div className="flex-1 flex flex-col items-center justify-center pb-32">
        {/* Header with Stats */}
        <div className="w-full max-w-6xl mt-8 px-4 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-2">
              <span className="text-4xl">🛍️</span>
              All Stores
            </h1>
            <div className="flex gap-4 text-white">
              <div className="text-center">
                <div className="text-2xl font-bold">{listings.length}</div>
                <div className="text-sm">Total Listings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Object.keys(sellers).length}</div>
                <div className="text-sm">Active Sellers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{favorites.size}</div>
                <div className="text-sm">Favorites</div>
              </div>
            </div>
          </div>

          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-xl mb-6 border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                <span className="text-xl">👁️</span>
                Recently Viewed
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {recentlyViewed.slice(0, 5).map(listing => (
                  <div
                    key={listing.id}
                    className="flex-shrink-0 bg-gray-50 rounded-lg p-3 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      addToRecentlyViewed(listing);
                      handleViewSeller(listing.userId);
                    }}
                  >
                    {listing.images && listing.images.length > 0 && (
                      <img src={listing.images[0]} alt={listing.title} className="w-16 h-16 object-cover rounded mb-2" />
                    )}
                    <div className="text-xs font-medium text-gray-800 truncate w-20">{listing.title}</div>
                    <div className="text-xs text-gray-600">{formatPrice(listing.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="bg-white rounded-xl p-6 shadow-xl mb-6 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
              <input
                type="text"
                placeholder="Search listings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Search listings"
              />

              <div className="relative">
                <select
                  multiple
                  value={[...selectedCategories]}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedCategories(new Set(values));
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 w-full"
                  aria-label="Filter by categories"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="absolute right-2 top-2 text-xs text-gray-500">
                  {selectedCategories.size} selected
                </div>
              </div>

              <input
                type="number"
                placeholder="Min Price"
                value={priceRange.min}
                onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Minimum price"
              />

              <input
                type="number"
                placeholder="Max Price"
                value={priceRange.max}
                onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Maximum price"
              />

              {userLocation && (
                <input
                  type="number"
                  placeholder="Max Distance (km)"
                  value={distanceFilter}
                  onChange={(e) => setDistanceFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  aria-label="Maximum distance in kilometers"
                />
              )}

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                aria-label="Sort listings"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                {userLocation && <option value="distance">Distance</option>}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {showFilters ? 'Hide' : 'Show'} Filters
                </button>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategories(new Set());
                    setPriceRange({ min: '', max: '' });
                    setDistanceFilter('');
                    setSortBy('newest');
                  }}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
              <div className="text-sm text-gray-600">
                Showing {paginatedListings.length} of {sortedListings.length} listings
              </div>
            </div>
          </div>
        </div>

        {sortedListings.length > 0 ? (
          <div className="w-full max-w-6xl px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedListings.map(listing => {
                const seller = sellers[listing.userId];
                const distance = userLocation && seller && seller.lat && seller.lng
                  ? (haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) / 1000).toFixed(1)
                  : null;
                const distanceToSeller = seller && userLocation && typeof seller.lat === 'number' && typeof seller.lng === 'number'
                  ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng)
                  : Infinity;
                const promoActiveForUser = seller && seller.promo_active && typeof seller.promo_radius_meters === 'number'
                  ? distanceToSeller <= seller.promo_radius_meters
                  : false;

                return (
                  <div key={listing.id} className="relative bg-white rounded-xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-100">
                    {/* Favorite Button */}
                    <button
                      onClick={() => toggleFavorite(listing.id)}
                      className="absolute top-4 right-4 p-2 rounded-full bg-white shadow-md hover:shadow-lg transition-shadow"
                      aria-label={favorites.has(listing.id) ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <span className="text-xl">{favorites.has(listing.id) ? '❤️' : '🤍'}</span>
                    </button>

                    {/* Images */}
                    {listing.images && listing.images.length > 0 && (
                      <div className="mb-4 flex gap-2 overflow-x-auto rounded-lg p-2 bg-gray-50">
                        {listing.images.slice(0, 4).map((img, idx) => (
                          <img key={idx} src={img} alt={`Listing ${idx + 1}`} className="w-16 h-16 object-cover rounded-lg shadow-sm" />
                        ))}
                      </div>
                    )}

                    {/* Seller Info */}
                    {seller && (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative">
                          {seller.photoURL ? (
                            <img
                              src={seller.photoURL}
                              alt={seller.displayName}
                              className="w-10 h-10 rounded-full border-2 border-teal-400"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-teal-400 to-purple-500 flex items-center justify-center">
                              <span className="text-sm text-white font-bold">
                                {seller.displayName?.charAt(0)?.toUpperCase() || 'S'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800">{seller.storeName || seller.displayName}</span>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <span key={i} className="text-yellow-400 text-xs">⭐</span>
                              ))}
                              <span className="text-xs text-gray-600">(4.8)</span>
                            </div>
                          </div>
                          {seller.description && (
                            <div className="text-xs text-gray-600 mt-1">{seller.description}</div>
                          )}
                          {seller.phone && (
                            <a
                              href={`https://wa.me/${seller.phone.replace(/\D/g, '')}?text=Hi, I'm interested in your products`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1 mt-1"
                            >
                              <span className="text-sm">💬</span>
                              WhatsApp: {seller.phone}
                            </a>
                          )}
                          {distance && (
                            <div className="text-xs text-gray-600 flex items-center gap-1">
                              <span className="text-lg">📍</span>
                              {distance} km away
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Listing Details */}
                    <div className="flex-1">
                      <h4 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                        <span className="text-xl">🏷️</span>
                        {listing.title}
                      </h4>
                      <p className="text-green-600 font-bold text-xl mb-2">{formatPrice(listing.price)}</p>
                      <p className="text-gray-600 text-sm leading-relaxed mb-3 line-clamp-3">{listing.description}</p>

                      {/* Category Badge */}
                      {listing.category && (
                        <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mb-3">
                          {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2">
                      <button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                        onClick={() => {
                          addToRecentlyViewed(listing);
                          handleViewSeller(listing.userId);
                        }}
                        aria-label={`View seller store for ${listing.title}`}
                      >
                        <span className="text-lg">🏪</span>
                        View Store
                      </button>

                      {user && role === 'buyer' && (
                        <button
                          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                          onClick={() => onNavigateToPlaceOrder({ listing, seller })}
                          aria-label={`Place order for ${listing.title}`}
                        >
                          <span className="text-lg">🛒</span>
                          Place Order
                        </button>
                      )}
                      {user && role === 'buyer' && (
                        <button
                          className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                          onClick={() => handleMessageSeller({ seller, listing, id: listing.userId, displayName: seller?.displayName || 'Seller' })}
                          aria-label={`Contact seller about ${listing.title}`}
                        >
                          <span className="text-lg">💬</span>
                          Contact Seller
                        </button>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8 mb-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Previous page"
                >
                  Previous
                </button>
                <span className="text-white px-4">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white text-gray-700 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-2xl text-center">
            <span className="text-6xl mb-4 block">🔍</span>
            <p className="text-white text-lg mb-2">No listings match your filters.</p>
            <p className="text-white text-sm">Try adjusting your search criteria or clearing filters.</p>
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 text-white py-6 flex justify-center gap-4 z-50 shadow-2xl">
        <button
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          onClick={onBack}
        >
          <span className="text-xl">⬅️</span>
          Back to Map
        </button>
      </footer>
    </div>
  );
}

export default BuyerStores;
