
import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { MapContainer, TileLayer } from 'react-leaflet';
import MapView from './components/MapView';
import BuyersPage from './components/BuyersPage';
import MapControls from './components/MapControls';
import { auth, db } from './firebase';
import { setDoc, getDoc, doc } from 'firebase/firestore';
import 'leaflet/dist/leaflet.css';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import DraggableSidebar from './components/DraggableSidebar';
import Listings from './components/Listings';
import RequireRole from './components/RequireRole';
import SplashScreen from './components/SplashScreen';
import StaffLogin from './components/StaffLogin';
import StaffDashboard from './components/StaffDashboard';

import SellerInbox from './components/SellerInbox';
import BuyerMessages from './components/BuyerMessages';
import BuyerStores from './components/BuyerStores';
import BuyerMyOrders from './components/BuyerMyOrders';
import MessageSellerModal from './components/MessageSellerModal';
import PlaceOrderPage from './pages/PlaceOrderPage';
import SellerOrders from './components/SellerOrders';
import SellerProfile from './components/SellerProfile';
import SellerListings from './components/SellerListings';
import { setNgrokUrl } from './utils/linkUtils';
import { FaMapMarkerAlt, FaComments, FaDollarSign, FaUserCheck, FaShoppingCart, FaStore, FaArrowRight, FaUserShield } from 'react-icons/fa';


const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/staff-dashboard" element={<StaffDashboard />} />
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </Router>
  );
};

const MainApp = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [showListings, setShowListings] = useState(false);
  const [showSellerListings, setShowSellerListings] = useState(null);
  const [showInbox, setShowInbox] = useState(false);
  const [showBuyerMessages, setShowBuyerMessages] = useState(false);
  const [showBuyerStores, setShowBuyerStores] = useState(false);
  const [showBuyerMyOrders, setShowBuyerMyOrders] = useState(false);
  const [showBuyerMap, setShowBuyerMap] = useState(false);
  const [showSellerOrders, setShowSellerOrders] = useState(false);
  const [showSellerProfile, setShowSellerProfile] = useState(false);
  const [showBuyerProfile, setShowBuyerProfile] = useState(false);
  const [showPlaceOrderPage, setShowPlaceOrderPage] = useState(false);
  const [placeOrderData, setPlaceOrderData] = useState(null);
  const [showMessageSellerModal, setShowMessageSellerModal] = useState(false);
  const [messageSellerData, setMessageSellerData] = useState(null);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [sharedSellerId, setSharedSellerId] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);



  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); // 3 seconds
    return () => clearTimeout(timer);
  }, []);

  // Handle online/offline status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle URL parameters for shared seller links
  React.useEffect(() => {
    const path = window.location.pathname;
    const pathParts = path.split('/');
    if (pathParts[1] === 'seller' && pathParts[2]) {
      setSharedSellerId(pathParts[2]);
    }
  }, []);

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

  // Show shared seller listings and contact details
  if (sharedSellerId) {
    return (
      <>
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-yellow-500 text-white text-center py-2 fixed top-0 left-0 w-full z-50">
            You're offline. Some features may be limited.
          </div>
        )}
        <SellerListings
          sellerId={sharedSellerId}
          onBack={() => setSharedSellerId(null)}
          user={user}
          isSharedView={true}
        />
      </>
    );
  }

  // Show splash screen
  if (showSplash) {
    return <SplashScreen />;
  }

  // Show place order page
  if (showPlaceOrderPage && placeOrderData) {
    return (
      <PlaceOrderPage
        listing={placeOrderData.listing}
        seller={placeOrderData.seller}
        buyer={user}
        onBack={() => {
          setShowPlaceOrderPage(false);
          setPlaceOrderData(null);
        }}
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
          onViewOrders={() => setShowBuyerOrders(true)}
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
        user={user}
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

  // Show buyer my orders page
  if (showBuyerMyOrders && user && role === 'buyer') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <div className="mb-8 w-full max-w-6xl mt-16">
            <BuyerMyOrders buyerId={user.uid} onBack={() => setShowBuyerMyOrders(false)} />
          </div>
        </div>
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowBuyerMyOrders(false)}>Back</button>
        </div>
      </div>
    );
  }

  // Show buyers page for sellers
  if (showBuyerMap && user && role === 'seller') {
    return (
      <BuyersPage
        sellerId={user.uid}
        onBack={() => setShowBuyerMap(false)}
        onViewBuyerOrders={(buyerId) => {
          // Navigate to buyer orders page for this specific buyer
          setShowSellerListings(`buyer-orders-${buyerId}`);
        }}
      />
    );
  }

  // Show seller orders page
  if (showSellerOrders && user && role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <div className="mb-8 w-full max-w-6xl mt-16">
            <SellerOrders sellerId={user.uid} />
          </div>
        </div>
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowSellerOrders(false)}>Back</button>
        </div>
      </div>
    );
  }

  // Show seller profile page
  if (showSellerProfile && user && role === 'seller') {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-gray-400 via-gray-300 to-gray-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <div className="mb-8 w-full max-w-4xl mt-16">
            <SellerProfile sellerId={user.uid} />
          </div>
        </div>
        <div className="flex justify-center mt-4">
          <button className="bg-gray-700 text-white px-4 py-2 rounded" onClick={() => setShowSellerProfile(false)}>Back</button>
        </div>
      </div>
    );
  }





  // Enhanced footer component - visible on main menu page with professional styling
  const renderFooter = () => {
    return (
      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white py-6 sm:py-8 md:py-10 flex justify-center gap-4 sm:gap-6 md:gap-8 z-50 shadow-2xl border-t-2 border-slate-600 backdrop-blur-lg bg-opacity-95">
        <div className="flex gap-2 sm:gap-3 md:gap-4 px-4 sm:px-6 md:px-8 w-full max-w-7xl justify-between items-center">
          <button
            className="flex-1 bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-blue-400 hover:to-blue-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-blue-400"
            onClick={() => {
              setShowMap(true);
              setShowListings(false);
              setShowSellerListings(null);
            }}
          >
            <span className="flex items-center justify-center gap-2 sm:gap-3">
              <FaMapMarkerAlt className="text-lg sm:text-xl md:text-2xl" />
              <span>Map</span>
            </span>
          </button>
          {role === 'seller' && (
            <>
              <button
                className="flex-1 bg-gradient-to-br from-green-500 to-green-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-green-400 hover:to-green-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-green-400"
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
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaStore className="text-lg sm:text-xl md:text-2xl" />
                  <span>Listings</span>
                </span>
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-purple-400 hover:to-purple-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-purple-400"
                onClick={() => setShowInbox(true)}
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaComments className="text-lg sm:text-xl md:text-2xl" />
                  <span>Inbox</span>
                </span>
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-orange-400 hover:to-orange-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-orange-400"
                onClick={() => setShowSellerOrders(true)}
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaShoppingCart className="text-lg sm:text-xl md:text-2xl" />
                  <span>Orders</span>
                </span>
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-pink-500 to-pink-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-pink-400 hover:to-pink-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-pink-400"
                onClick={() => setShowSellerProfile(true)}
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaUserCheck className="text-lg sm:text-xl md:text-2xl" />
                  <span>Profile</span>
                </span>
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-red-500 to-red-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-red-400 hover:to-red-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-red-400"
                onClick={() => setShowBuyerMap(true)}
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaUserShield className="text-lg sm:text-xl md:text-2xl" />
                  <span>Buyers</span>
                </span>
              </button>
            </>
          )}
          {role === 'buyer' && (
            <>
              <button
                className="flex-1 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-400 hover:to-indigo-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-indigo-400"
                onClick={() => setShowBuyerMessages(true)}
                title="My Messages"
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaComments className="text-lg sm:text-xl md:text-2xl" />
                  <span>Messages</span>
                </span>
              </button>

              <button
                className="flex-1 bg-gradient-to-br from-teal-500 to-teal-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-teal-400 hover:to-teal-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-teal-400"
                onClick={() => setShowBuyerMyOrders(true)}
                title="My Orders"
              >
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaShoppingCart className="text-lg sm:text-xl md:text-2xl" />
                  <span>Orders</span>
                </span>
              </button>
              <button
                className="flex-1 bg-gradient-to-br from-yellow-500 to-yellow-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-yellow-400 hover:to-yellow-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-yellow-400"
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
                <span className="flex items-center justify-center gap-2 sm:gap-3">
                  <FaMapMarkerAlt className="text-lg sm:text-xl md:text-2xl" />
                  <span>Location</span>
                </span>
              </button>
            </>
          )}
          <button
            className="flex-1 bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-bold px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 rounded-xl shadow-lg hover:shadow-xl hover:from-cyan-400 hover:to-cyan-600 transition-all duration-200 transform hover:scale-105 footer-btn text-base sm:text-lg md:text-xl whitespace-nowrap min-h-[60px] sm:min-h-[70px] md:min-h-[80px] border border-cyan-400"
            onClick={() => {
              setShowBuyerStores(true);
              setShowMap(false);
              setShowListings(false);
              setShowSellerListings(null);
            }}
          >
            <span className="flex items-center justify-center gap-2 sm:gap-3">
              <FaStore className="text-lg sm:text-xl md:text-2xl" />
              <span>Stores</span>
            </span>
          </button>

        </div>
        <DraggableSidebar
          role={role}
          onNavigateToInbox={() => setShowInbox(true)}
          onNavigateToMessages={() => setShowBuyerMessages(true)}
        />
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
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ZEDLOCA
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
                Connect with local sellers and buyers in your area. Discover unique products,
                support local businesses, and build your community marketplace.
              </p>

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
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaUserCheck className="text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sign Up</h3>
                <p className="text-gray-600">Create your account and choose whether you're buying or selling</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaStore className="text-xl" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect</h3>
                <p className="text-gray-600">Browse listings or create your own products for sale</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                  <FaShoppingCart className="text-xl" />
                </div>
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
    <>
      <MapView
        onViewStore={setShowSellerListings}
        onBack={() => setShowMap(false)}
        role={role}
        onNavigateToInbox={() => setShowInbox(true)}
        onNavigateToMessages={() => setShowBuyerMessages(true)}
      />
    </>
  );
}

export default App;
