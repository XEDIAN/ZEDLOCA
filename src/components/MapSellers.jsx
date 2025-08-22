import React, { useEffect, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import L from 'leaflet';

const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
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
      // Optionally fit map to sellers
      // const bounds = L.latLngBounds(sellers.map(s => [s.lat, s.lng]));
      // map.fitBounds(bounds);
    }
  }, [sellers, map]);

  return (
    <>
      {sellers.map(seller => (
        <Marker key={seller.id} position={[seller.lat, seller.lng]} icon={sellerIcon}>
          <Popup>
            <div className="flex flex-col items-center">
              {seller.photoURL && (
                <img src={seller.photoURL} alt="Seller" className="w-16 h-16 rounded-full mb-2" />
              )}
              <strong>{seller.displayName}</strong><br />
              <span className="text-xs text-gray-600">{seller.email}</span>
              {/* You can add more details here, e.g., phone, description, etc. */}
              {/* <a href={`/seller/${seller.uid}`} className="text-blue-600 underline mt-2">View Listings</a> */}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

export default MapSellers;
