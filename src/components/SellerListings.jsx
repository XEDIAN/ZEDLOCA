import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import ImageLightbox from './ImageLightbox';

/**
 * Simple haversine implementation to compute distances in meters.
 * Mirrors the helper used in MapSellers so promo radius checks are consistent.
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

function SellerListings({ sellerId, onBack, user }) {
  const [seller, setSeller] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  
  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Open lightbox with image(s)
  const openLightbox = (images, index = 0) => {
    if (images && images.length > 0) {
      setLightboxImages(images);
      setLightboxIndex(index);
      setLightboxOpen(true);
    }
  };

  // Close lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

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

  useEffect(() => {
    if (!sellerId) return;

    // Fetch seller profile
    const fetchSellerProfile = async () => {
      try {
        const sellerDoc = await getDoc(doc(db, 'sellers', sellerId));
        if (sellerDoc.exists()) {
          setSeller(sellerDoc.data());
        }
      } catch (err) {
        console.error('Error fetching seller profile:', err);
      }
    };

    // Fetch seller listings ordered by newest first (requires composite index: userId asc + createdAt desc)
    const q = query(
      collection(db, 'listings'),
      where('userId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );

    const unsubListings = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(docs);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching listings:', error);
      setLoading(false);
    });

    fetchSellerProfile();

    return () => unsubListings();
  }, [sellerId]);

  // Try to get a precise user location; if denied/fails we keep it null which disables promo visibility
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

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 mt-16">Loading...</h1>
        </div>
      </div>
    );
  }

  // Compute distance to seller for promotion checks
  const distanceToSeller = (seller && userLocation && typeof seller.lat === 'number' && typeof seller.lng === 'number')
    ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng)
    : Infinity;

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
      <div className="flex-1 flex flex-col items-center justify-center pb-24">
        {seller ? (
          <div className="w-full max-w-lg px-4 mt-4">
            <div className="mb-4 p-4 bg-white rounded-lg shadow-lg">
              <div className="flex items-start gap-3">
                {seller.photoURL && (
                  <img src={seller.photoURL} alt={seller.displayName} className="w-16 h-16 rounded-full border-2 border-gray-200 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col gap-2 mb-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight break-words">{seller.storeName || seller.displayName}</h2>
                  </div>
                  <div className="flex flex-col gap-2 items-center mb-2">
                    <button
                      onClick={() => handleNavigateToSeller(seller)}
                      className="bg-red-600 hover:bg-red-700 text-white font-semibold px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                      title="Get directions to this seller"
                    >
                      <span className="text-base">🗺️</span>
                      Navigate
                    </button>
                    {seller.phone && (
                      <a
                        href={`tel:${seller.phone}`}
                        className="bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-2 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm"
                      >
                        <span className="text-base">📞</span>
                        Call
                      </a>
                    )}
                  </div>
                  <p className="text-gray-600 text-sm mb-2 break-words">{seller.email}</p>
                  {seller.description && (
                    <p className="text-gray-700 text-sm mb-3 leading-relaxed">{seller.description}</p>
                  )}
                  {seller.phone && (
                    <a
                      href={`https://wa.me/${seller.phone.replace(/\D/g, '')}?text=Hi, I'm interested in your products`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-700 font-medium text-sm mb-3 inline-flex items-center gap-1"
                    >
                      <span className="text-base">💬</span>
                      WhatsApp: {seller.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold mb-3 text-gray-800 px-1">Store Listings</h3>

            {listings.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {listings.map(listing => (
                  <div key={listing.id} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                    {listing.images && listing.images.length > 0 && (
                      <div className="relative">
                        <img 
                          src={listing.images[0]} 
                          alt={listing.title} 
                          className="w-full h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openLightbox(listing.images, 0)}
                        />
                        {listing.images.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-full">
                            +{listing.images.length - 1} more
                          </span>
                        )}
                        {listing.category && (
                          <span className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                            {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                          </span>
                        )}
                        {listing.promo_active && distanceToSeller <= (listing.promo_radius_meters || 0) && (
                          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Promo
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-3">
                      <h4 className="font-bold text-base mb-2 leading-tight">{listing.title}</h4>
                      <p className="text-gray-700 font-semibold text-lg mb-2">{listing.price}</p>
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2 leading-relaxed">{listing.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">📦</div>
                <p className="text-gray-600 text-base">This seller has no listings yet.</p>
                <p className="text-gray-500 text-sm mt-1">Check back later for new products!</p>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full max-w-sm px-4">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Seller not found</h2>
            <p className="text-gray-600 text-sm">The requested seller profile could not be loaded.</p>
          </div>
        )}
      </div>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-3 flex justify-center z-50">
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded-lg shadow hover:bg-gray-200 transition text-sm"
          onClick={onBack}
        >
          Back
        </button>
      </footer>

      {/* Image Lightbox */}
      <ImageLightbox
        isOpen={lightboxOpen}
        images={lightboxImages}
        initialIndex={lightboxIndex}
        onClose={closeLightbox}
      />
    </div>
  );
}

export default SellerListings;
