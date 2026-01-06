import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import MessageSellerModal from './MessageSellerModal';
import L from 'leaflet';

const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png', // Store icon
  iconSize: isMobile ? [22, 22] : [32, 32],
  iconAnchor: isMobile ? [11, 22] : [16, 32],
  popupAnchor: isMobile ? [0, -22] : [0, -32],
});

const promotedIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616490.png', // Star/Promo icon
  iconSize: isMobile ? [24, 24] : [36, 36],
  iconAnchor: isMobile ? [12, 24] : [18, 36],
  popupAnchor: isMobile ? [0, -24] : [0, -36],
});

const listingIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1484/1484845.png', // Box icon
  iconSize: isMobile ? [18, 18] : [28, 28],
  iconAnchor: isMobile ? [9, 18] : [14, 28],
  popupAnchor: isMobile ? [0, -18] : [0, -28],
});

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

function MapSellers({ onViewStore }) {
  const [sellers, setSellers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [messageModal, setMessageModal] = useState({ open: false, seller: null });
  const loggedImpressionsRef = useRef(new Set());
  const map = useMap();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      setSellers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Try to get a precise user location; if denied/fails, fall back to current map center
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          // fallback to map center if available
          try {
            const center = map.getCenter();
            setUserLocation({ lat: center.lat, lng: center.lng });
          } catch {
            setUserLocation(null);
          }
        },
        { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
      );
    } else {
      try {
        const center = map.getCenter();
        setUserLocation({ lat: center.lat, lng: center.lng });
      } catch {
        setUserLocation(null);
      }
    }
    return () => { cancelled = true; };
  }, [map]);

  useEffect(() => {
    if (sellers.length > 0) {
      // Log seller coordinates for debugging
      sellers.forEach(seller => {
        console.log(`Seller ${seller.id} coordinates:`, seller.lat, seller.lng);
      });
      // Auto-zoom map to sellers with valid coordinates
      const validCoords = sellers.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number');
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds);
      }
    }
  }, [sellers, map]);

  // Log a single impression per session for promos that are active and within radius
  useEffect(() => {
    if (!userLocation || !sellers.length) return;
    sellers.forEach(async (seller) => {
      const distanceToUser = haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng);
      const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;
      if (promoActive && !loggedImpressionsRef.current.has(seller.id)) {
        try {
          await addDoc(collection(db, 'promoEvents'), {
            sellerId: seller.id,
            userId: auth?.currentUser?.uid || null,
            eventType: 'impression',
            distance: Math.round(distanceToUser),
            timestamp: serverTimestamp(),
          });
          loggedImpressionsRef.current.add(seller.id);
          console.log('Logged promo impression for', seller.id);
        } catch (err) {
          console.error('Failed to log promo impression:', err);
        }
      }
    });
  }, [sellers, userLocation]);

  const handleContactClick = async (seller, distanceToUser) => {
    try {
      await addDoc(collection(db, 'promoEvents'), {
        sellerId: seller.id,
        userId: auth?.currentUser?.uid || null,
        eventType: 'contact_click',
        distance: Math.round(distanceToUser),
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error('Failed to log contact click:', err);
    }
    alert('Contact seller feature coming soon!');
  };

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
              <Popup>
                <div className="flex flex-col items-center">
                  <span className="text-2xl mb-2" role="img" aria-label="Store">🏬</span>
                  <strong>{promoActive ? 'Promotion' : 'Seller'}</strong>
                  {promoActive && seller.promo_text && (
                    <p className="text-sm mt-2 px-2 text-center">{seller.promo_text}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button
                      className="bg-green-600 text-white px-3 py-1 rounded text-sm shadow hover:bg-green-700"
                      onClick={() => onViewStore(seller.id)}
                    >View Store</button>
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded text-sm shadow hover:bg-blue-700"
                      onClick={() => setMessageModal({ open: true, seller })}
                    >Message</button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      <MessageSellerModal
        open={messageModal.open}
        onClose={() => setMessageModal({ open: false, seller: null })}
        sellerId={messageModal.seller?.id || ''}
        sellerName={messageModal.seller?.displayName || ''}
        buyerId={auth?.currentUser?.uid || ''}
      />
    </>
  );
}

export default MapSellers;
