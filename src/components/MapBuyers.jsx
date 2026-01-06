import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import L from 'leaflet';

const isMobile = typeof window !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent);

function MapBuyers({ sellerId }) {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const map = useMap();
  const markersRef = useRef({});

  // Custom buyer icon
  const buyerIcon = useMemo(() => L.divIcon({
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
  }), []);

  useEffect(() => {
    if (!sellerId) return;

    setLoading(true);
    // Query messages where this seller has received messages with buyer locations
    const q = query(
      collection(db, 'messages'),
      where('sellerId', '==', sellerId),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const buyerLocations = {};
      snapshot.docs.forEach(doc => {
        const msg = doc.data();
        if (msg.buyerLat && msg.buyerLng && msg.buyerId) {
          if (!buyerLocations[msg.buyerId] || 
              buyerLocations[msg.buyerId].timestamp < msg.timestamp) {
            buyerLocations[msg.buyerId] = {
              id: msg.buyerId,
              lat: msg.buyerLat,
              lng: msg.buyerLng,
              lastMessage: msg.message,
              timestamp: msg.timestamp,
              displayName: msg.buyerId // Could be enhanced with user profile data
            };
          }
        }
      });

      const buyersArray = Object.values(buyerLocations);
      setBuyers(buyersArray);
      setLoading(false);
    }, (err) => {
      setError('Failed to load buyer locations: ' + err.message);
      setLoading(false);
    });

    return () => unsub();
  }, [sellerId]);

  const handleNavigateToBuyer = (buyer) => {
    if (!buyer.lat || !buyer.lng) return;

    // Try to get seller's current location for directions
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const sellerLat = pos.coords.latitude;
          const sellerLng = pos.coords.longitude;
          const origin = `${sellerLat},${sellerLng}`;
          const destination = `${buyer.lat},${buyer.lng}`;
          const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;
          window.open(googleMapsUrl, '_blank');
        },
        (err) => {
          // Fallback to destination-only URL if location access fails
          console.warn('Could not get seller location for directions:', err.message);
          const googleMapsUrl = isMobile
            ? `https://maps.google.com/maps?q=${buyer.lat},${buyer.lng}&ll=${buyer.lat},${buyer.lng}&z=16`
            : `https://www.google.com/maps/dir/?api=1&destination=${buyer.lat},${buyer.lng}`;
          window.open(googleMapsUrl, '_blank');
        },
        { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5, timeout: 10000 }
      );
    } else {
      // Fallback for browsers without geolocation
      const googleMapsUrl = isMobile
        ? `https://maps.google.com/maps?q=${buyer.lat},${buyer.lng}&ll=${buyer.lat},${buyer.lng}&z=16`
        : `https://www.google.com/maps/dir/?api=1&destination=${buyer.lat},${buyer.lng}`;
      window.open(googleMapsUrl, '_blank');
    }
  };

  if (loading) {
    return null; // Don't show loading on map
  }

  if (error) {
    console.error('MapBuyers error:', error);
    return null;
  }

  return (
    <>
      {buyers.map(buyer => (
        <Marker
          key={buyer.id}
          position={[buyer.lat, buyer.lng]}
          icon={buyerIcon}
          ref={el => {
            if (el) markersRef.current[buyer.id] = el;
          }}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-gray-800 mb-2">Buyer: {buyer.displayName}</h3>
              <p className="text-sm text-gray-600 mb-2">
                Last message: {buyer.lastMessage?.substring(0, 50)}...
              </p>
              <p className="text-xs text-gray-500 mb-3">
                {buyer.timestamp?.toDate?.()?.toLocaleDateString()}
              </p>
              <button
                onClick={() => handleNavigateToBuyer(buyer)}
                className="w-full bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
              >
                🧭 Navigate to Buyer
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default MapBuyers;
