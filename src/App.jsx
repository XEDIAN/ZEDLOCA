
import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapSellers from './components/MapSellers';
import { auth, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';


function App() {
  const [showMap, setShowMap] = useState(false);

  React.useEffect(() => {
    if (!showMap) return;
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          const { latitude, longitude } = pos.coords;
          await setDoc(doc(db, 'sellers', user.uid), {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            lat: latitude,
            lng: longitude,
            photoURL: user.photoURL || '',
            updatedAt: new Date(),
          }, { merge: true });
        });
      }
    });
    return () => unsubscribe();
  }, [showMap]);

  if (!showMap) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-green-50">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-green-800 mb-4 mt-16">WELCOME TO ZEDLOCA MARKET PLACE</h1>
          <p className="text-lg text-green-700 mb-8">Buy and sell locally with ease. Sign in to get started!</p>
          <div className="mb-8">
            <Auth />
            <UserProfile />
          </div>
        </div>
        <footer className="bg-green-700 text-white py-4 w-full flex justify-center">
          <button
            className="bg-white text-green-700 font-bold px-6 py-2 rounded shadow hover:bg-green-100 transition"
            onClick={() => setShowMap(true)}
          >
            View Map
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative bg-green-50">
      <h1 className="text-3xl font-bold absolute top-0 left-0 p-4 text-white bg-green-700 z-20">
        WELCOME TO ZEDLOCA MARKET PLACE
      </h1>
      <div className="absolute top-20 left-0 w-full z-30 flex flex-col items-center">
        <Auth />
        <UserProfile />
      </div>
      <MapContainer
        center={[-15.417, 28.283]} // Lusaka coordinates
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <MapSellers />
      </MapContainer>
      <footer className="bg-green-700 text-white py-4 w-full flex justify-center absolute bottom-0 left-0 z-40">
        <button
          className="bg-white text-green-700 font-bold px-6 py-2 rounded shadow hover:bg-green-100 transition"
          onClick={() => setShowMap(false)}
        >
          Hide Map
        </button>
      </footer>
    </div>
  );
}

export default App;

