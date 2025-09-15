import React, { useEffect, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import L from 'leaflet';

const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png', // Store icon
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

const listingIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1484/1484845.png', // Box icon
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});

function MapSellers() {
  const [sellers, setSellers] = useState([]);
  const map = useMap();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      setSellers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

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

  return (
    <>
      {sellers
        .filter(seller => typeof seller.lat === 'number' && typeof seller.lng === 'number')
        .map(seller => (
          <Marker key={seller.id} position={[seller.lat, seller.lng]} icon={sellerIcon}>
            <Popup>
              <div className="flex flex-col items-center">
                <span className="text-2xl mb-2" role="img" aria-label="Store">🏬</span>
                <strong>Seller</strong>
                <button
                  className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-sm shadow hover:bg-blue-700"
                  onClick={() => alert('Contact seller feature coming soon!')}
                >Contact Seller</button>
              </div>
            </Popup>
          </Marker>
        ))}
    </>
  );
}

export default MapSellers;
