
import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapSellers from './components/MapSellers';
import MapControls from './components/MapControls';
import { auth, db } from './firebase';
import { setDoc, getDoc, doc } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import DraggableSidebar from './components/DraggableSidebar';
import Listings from './components/Listings';
import RequireRole from './components/RequireRole';


import SellerInbox from './components/SellerInbox';
import BuyerMessages from './components/BuyerMessages';
import BuyerStores from './components/BuyerStores';
import MessageSellerModal from './components/MessageSellerModal';

const App = () => {
  const [showMap, setShowMap] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showSellerListings, setShowSellerListings] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showBuyerMessages, setShowBuyerMessages] = useState(false);
  const [showBuyerStores, setShowBuyerStores] = useState(false);
  const [showMessageSellerModal, setShowMessageSellerModal] = useState(false);
  const [messageSellerData, setMessageSellerData] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        setRoleLoading(true);
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && userSnap.data().role) {
            setRole(userSnap.data().role);
          } else {
            setRole(null);
          }
        } catch {
          setRole(null);
        }
        setRoleLoading(false);
      } else {
        setRole(null);
        setShowMap(false);
      }
    });
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

  // Show buyer stores page
  if (showBuyerStores) {
    return (
      <>
        <BuyerStores
          onViewSeller={setShowSellerListings}
          onBack={() => setShowBuyerStores(false)}
          onMessageSeller={(sellerData) => {
            setMessageSellerData(sellerData);
            setShowMessageSellerModal(true);
          }}
          user={user}
          role={role}
        />
        <MessageSellerModal
          open={showMessageSellerModal}
          onClose={() => setShowMessageSellerModal(false)}
          sellerId={messageSellerData?.id}
          sellerName={messageSellerData?.displayName}
          buyerId={user?.uid}
        />
      </>
    );
  }

  // Show seller listings
  if (showSellerListings) {
    return (
      <SellerListings
        sellerId={showSellerListings}
        onBack={() => setShowSellerListings(null)}
      />
    );
  }

  // Show seller inbox
  if (showInbox && user && role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <SellerInbox sellerId={user.uid} />
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowInbox(false)}>Back</button>
        </div>
      </div>
    );
  }

  // Show buyer messages page
  if (showBuyerMessages && user && role === 'buyer') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <BuyerMessages buyerId={user.uid} />
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowBuyerMessages(false)}>Back</button>
        </div>
      </div>
    );
  }

  // Consistent footer component for authenticated users
  const renderFooter = () => {
    if (!user || !role) return null;
    return (
      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-4 flex justify-center gap-4 z-50">
        <button
          className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
          onClick={() => {
            setShowMap(true);
            setShowListings(false);
            setShowSellerListings(null);
          }}
        >
          View Map
        </button>
        {role === 'seller' && (
          <>
            <button
              className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
              onClick={() => {
                setShowListings(true);
                setShowMap(false);
                setShowSellerListings(null);
                // Prompt seller to register location
                if (user && navigator.geolocation) {
                  window.alert('Please allow location access to register your current location for your store.');
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
                  }, null, { enableHighAccuracy: true });
                }
              }}
            >
              My Listings
            </button>
            <button
              className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-blue-200 transition footer-btn"
              onClick={() => setShowInbox(true)}
            >
              Inbox
            </button>
          </>
        )}
        {role === 'buyer' && (
          <button
            className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-blue-200 transition footer-btn"
            onClick={() => setShowBuyerMessages(true)}
            title="My Messages"
          >
            <span role="img" aria-label="Messages">💬</span>
          </button>
        )}
        <button
          className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
          onClick={() => {
            setShowBuyerStores(true);
            setShowMap(false);
            setShowListings(false);
            setShowSellerListings(null);
          }}
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
          <h1 className="welcome-title text-4xl font-bold text-gray-800 mb-4 mt-16">ZEDLOCA</h1>
          <p className="welcome-subtitle">Your own digital network</p>
          <div className="mb-8">
            <Auth />
            {user && roleLoading && (
              <div className="text-gray-600 mt-2">Loading role...</div>
            )}
            {user && !role && !roleLoading && (
              <div className="text-red-600 mt-2">No role assigned. Please sign out and sign in again to select a role.</div>
            )}
          </div>
        </div>
        {renderFooter()}
      </div>
    );
  }

  // Show listings panel/modal
  if (showListings && user) {
    return (
      <RequireRole role="seller" userRole={role} fallback={<div className="text-center mt-16 text-red-600">Access denied: Sellers only</div>}>
        <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
          <div className="flex-1 flex flex-col items-center justify-center pb-32">
            <h1 className="text-4xl font-bold text-gray-800 mb-4 mt-16">MY LISTINGS</h1>
            <div className="mb-8 w-full max-w-2xl">
              <Listings userId={user.uid} />
            </div>
          </div>
          {renderFooter()}
        </div>
      </RequireRole>
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
        <h1 className="welcome-title text-3xl font-bold text-white text-center py-4 drop-shadow">
          ZEDLOCA
        </h1>
      </header>
      <div className="absolute top-20 left-0 w-full z-30 flex flex-col items-center pb-32">
        <Auth />
      </div>
      <MapContainer
        center={[-15.417, 28.283]} // Lusaka coordinates
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        className="z-0 map-container-with-footer"
        zoomControl={false} // Disable default zoom controls
      >
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        />
        <MapSellers onViewStore={setShowSellerListings} />
        <MapControls />
      </MapContainer>
      {/* Footer theme update */}
      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-700 via-gray-600 to-gray-800 text-white py-4 flex justify-center gap-4 z-50">
        <button
          className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
          onClick={() => {
            setShowMap(true);
            setShowListings(false);
            setShowSellerListings(null);
          }}
        >
          View Map
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
          onClick={() => {
            setShowListings(true);
            setShowMap(false);
            setShowSellerListings(null);
          }}
        >
          My Listings
        </button>
        <button
          className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-gray-200 transition footer-btn"
          onClick={() => {
            setShowBuyerStores(true);
            setShowMap(false);
            setShowListings(false);
            setShowSellerListings(null);
          }}
        >
          Stores
        </button>
        <DraggableSidebar />
      </footer>
    </div>
  );
}

export default App;
