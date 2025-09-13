import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapSellers from './components/MapSellers';
import MapControls from './components/MapControls';
import { auth, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import DraggableSidebar from './components/DraggableSidebar';
import Listings from './components/Listings';
import SellerListings from './components/SellerListings';

function App() {
  const [showMap, setShowMap] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showSellerListings, setShowSellerListings] = useState(null);
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (!showMap) return;
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const { latitude, longitude } = pos.coords;
          (async () => {
            await setDoc(doc(db, 'sellers', user.uid), {
              uid: user.uid,
              displayName: user.displayName,
              email: user.email,
              lat: latitude,
              lng: longitude,
              photoURL: user.photoURL || '',
              updatedAt: new Date(),
            }, { merge: true });
          })();
        });
      }
    });
    return () => unsubscribe();
  }, [showMap]);

  // Show seller listings
  if (showSellerListings) {
    return (
      <SellerListings
        sellerId={showSellerListings}
        onBack={() => setShowSellerListings(null)}
      />
    );
  }

  // Consistent footer component for authenticated users
  const renderFooter = () => {
    if (!user) return null;
    
    return (
  <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-4 flex justify-center gap-4 z-50">
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => {
            setShowMap(true);
            setShowListings(false);
            setShowSellerListings(null);
          }}
        >
          View Map
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => {
            setShowListings(true);
            setShowMap(false);
            setShowSellerListings(null);
          }}
        >
          My Listings
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => setShowSellerListings(user.uid)}
        >
          Stores
        </button>
        <DraggableSidebar />
      </footer>
    );
  };

  if (!showMap && !showListings) {
    return (
  <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 mt-16">WELCOME TO ZEDLOCA MARKET PLACE</h1>
          <p className="text-lg text-gray-700 mb-8">Buy and sell locally with ease. Sign in to get started!</p>
          <div className="mb-8">
            <Auth />
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // Show listings panel/modal
  if (showListings && user) {
    return (
  <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <h1 className="text-4xl font-bold text-gray-800 mb-4 mt-16">MY LISTINGS</h1>
          <div className="mb-8 w-full max-w-2xl">
            <Listings userId={user.uid} />
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // Only allow map view if user is signed in
  if (!user) {
    setShowMap(false);
    setShowListings(false);
    return null;
  }

  return (
    <div className="h-screen w-screen relative bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
      <header className="fixed top-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 z-30 shadow-lg">
        <h1 className="text-3xl font-bold text-white text-center py-4 drop-shadow">
          WELCOME TO ZEDLOCA MARKET PLACE
        </h1>
      </header>
      <div className="absolute top-20 left-0 w-full z-30 flex flex-col items-center pb-32">
        <Auth />
      </div>
      <MapContainer
        center={[-15.417, 28.283]} // Lusaka coordinates
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
        zoomControl={false} // Disable default zoom controls
      >
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <MapSellers />
        <MapControls />
      </MapContainer>
      {/* Footer theme update */}
      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-4 flex justify-center gap-4 z-50">
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => {
            setShowMap(true);
            setShowListings(false);
            setShowSellerListings(null);
          }}
        >
          View Map
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => {
            setShowListings(true);
            setShowMap(false);
            setShowSellerListings(null);
          }}
        >
          My Listings
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-6 py-2 rounded shadow hover:bg-gray-200 transition"
          onClick={() => setShowSellerListings(user.uid)}
        >
          Stores
        </button>
        <DraggableSidebar />
      </footer>
    </div>
  );
}

export default App;
