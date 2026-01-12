
import React, { useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapView from './components/MapView';
import MapBuyers from './components/MapBuyers';
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
import PlaceOrderPage from './pages/PlaceOrderPage';

const App = () => {
  const [showMap, setShowMap] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showSellerListings, setShowSellerListings] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showBuyerMessages, setShowBuyerMessages] = useState(false);
  const [showBuyerStores, setShowBuyerStores] = useState(false);
  const [showBuyerMap, setShowBuyerMap] = useState(false);
  const [showPlaceOrderPage, setShowPlaceOrderPage] = useState(false);
  const [placeOrderData, setPlaceOrderData] = useState(null);
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

  // Show place order page
  if (showPlaceOrderPage && placeOrderData) {
    return (
      <PlaceOrderPage
        listing={placeOrderData.listing}
        seller={placeOrderData.seller}
        onBack={() => {
          setShowPlaceOrderPage(false);
          setPlaceOrderData(null);
        }}
        user={user}
      />
    );
  }

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
          onNavigateToPlaceOrder={(data) => {
            setPlaceOrderData(data);
            setShowPlaceOrderPage(true);
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

  // Show buyer map for sellers
  if (showBuyerMap && user && role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <MapBuyers sellerId={user.uid} />
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowBuyerMap(false)}>Back</button>
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
            <button
              className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-red-200 transition footer-btn"
              onClick={() => setShowBuyerMap(true)}
            >
              🗺️ Buyers
            </button>
          </>
        )}
        {role === 'buyer' && (
          <>
            <button
              className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-blue-200 transition footer-btn"
              onClick={() => setShowBuyerMessages(true)}
              title="My Messages"
            >
              <span role="img" aria-label="Messages">💬</span>
            </button>
            <button
              className="bg-white text-gray-800 font-bold px-4 py-2 rounded shadow hover:bg-green-200 transition footer-btn"
              onClick={() => {
                if (user && navigator.geolocation) {
                  window.alert('Please allow location access to update your location.');
                  navigator.geolocation.getCurrentPosition((pos) => {
                    const { latitude, longitude } = pos.coords;
                    (async () => {
                      await setDoc(doc(db, 'buyers', user.uid), {
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
              title="Update Location"
            >
              📍
            </button>
          </>
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
        <DraggableSidebar role={role} />
      </footer>
    );
  };

  if (!showMap && !showListings) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
                Welcome to{' '}
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ZEDLOCA
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Connect with local sellers and buyers in your area. Discover unique products,
                support local businesses, and build your community marketplace.
              </p>

              {/* User Type Selection */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-blue-100 hover:border-blue-300 transition-colors">
                  <div className="text-4xl mb-3">🛍️</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">I'm a Buyer</h3>
                  <p className="text-gray-600 text-sm mb-4">Discover local products and connect with sellers</p>
                  <div className="text-xs text-blue-600 font-medium">Popular choice</div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-purple-100 hover:border-purple-300 transition-colors">
                  <div className="text-4xl mb-3">🏪</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">I'm a Seller</h3>
                  <p className="text-gray-600 text-sm mb-4">Reach local customers and grow your business</p>
                  <div className="text-xs text-purple-600 font-medium">Start selling today</div>
                </div>
              </div>

              {/* Auth Section */}
              <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Get Started</h2>
                <Auth />
                {user && roleLoading && (
                  <div className="text-blue-600 mt-4 text-center">Loading your account...</div>
                )}
                {user && !role && !roleLoading && (
                  <div className="text-red-600 mt-4 text-center text-sm">
                    Please sign out and sign in again to select your role.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 rounded-full opacity-20"></div>
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-100 rounded-full opacity-20"></div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Why Choose ZEDLOCA?</h2>
              <p className="text-lg text-gray-600">Your local marketplace with modern features</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center p-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📍</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Location-Based</h3>
                <p className="text-gray-600">Find products and sellers in your local area with precise location matching</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💬</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Direct Communication</h3>
                <p className="text-gray-600">Chat directly with sellers and buyers for seamless transactions</p>
              </div>

              <div className="text-center p-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🆓</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Free to Use</h3>
                <p className="text-gray-600">No hidden fees or commissions. Just pure local commerce</p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
              <p className="text-lg text-gray-600">Simple steps to start buying or selling</p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">1</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Up</h3>
                <p className="text-gray-600">Create your account and choose whether you're buying or selling</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">2</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect</h3>
                <p className="text-gray-600">Browse listings or create your own products for sale</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">3</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Transact</h3>
                <p className="text-gray-600">Communicate directly and complete your local transactions</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="py-16 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-8">Join Our Growing Community</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div>
                <div className="text-4xl font-bold mb-2">100+</div>
                <div className="text-blue-100">Active Sellers</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">500+</div>
                <div className="text-blue-100">Products Listed</div>
              </div>
              <div>
                <div className="text-4xl font-bold mb-2">1000+</div>
                <div className="text-blue-100">Happy Customers</div>
              </div>
            </div>
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
    <MapView
      onViewStore={setShowSellerListings}
      onBack={() => setShowMap(false)}
    />
  );
}

export default App;
