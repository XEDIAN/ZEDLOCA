
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
  const [authInitialized, setAuthInitialized] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);



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
      console.log('Auth state changed:', u ? 'User signed in' : 'No user');
      setUser(u);
      setAuthInitialized(true);
      
      if (u) {
        setRoleLoading(true);
        try {
          const userRef = doc(db, 'users', u.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists() && userSnap.data().role) {
            const userRole = userSnap.data().role;
            console.log('User role loaded:', userRole);
            setRole(userRole);
            // Redirect buyer to stores page after login
            if (userRole === 'buyer') {
              setShowBuyerStores(true);
              setShowMap(false);
              setShowListings(false);
              setShowSellerListings(null);
              setShowBuyerMessages(false);
              setShowBuyerMyOrders(false);
              setShowBuyerMap(false);
              setShowSellerOrders(false);
              setShowSellerProfile(false);
              setShowPlaceOrderPage(false);
            }
            // Redirect seller to listings page after login
            if (userRole === 'seller') {
              setShowListings(true);
              setShowMap(false);
              setShowBuyerStores(false);
              setShowSellerListings(null);
              setShowBuyerMessages(false);
              setShowBuyerMyOrders(false);
              setShowBuyerMap(false);
              setShowSellerOrders(false);
              setShowSellerProfile(false);
              setShowPlaceOrderPage(false);
            }
          } else {
            console.log('No role found in Firestore, setting to null');
            setRole(null);
          }
        } catch (error) {
          console.error('Error loading user role:', error);
          setRole(null);
        } finally {
          setRoleLoading(false);
        }
      } else {
        console.log('No user signed in, clearing role and map');
        setRole(null);
        setShowMap(false);
        setRoleLoading(false);
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





  // Helper function to determine if main menu should be shown
  const shouldShowMainMenu = () => {
    return !showMap && 
           !showListings && 
           !showSellerListings && 
           !showInbox && 
           !showBuyerMessages && 
           !showBuyerStores && 
           !showBuyerMyOrders && 
           !showBuyerMap && 
           !showSellerOrders && 
           !showSellerProfile && 
           !showPlaceOrderPage && 
           user && 
           role && 
           !roleLoading && 
           authInitialized;
  };

  // Loading component for authentication state
  const renderAuthLoading = () => {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading your account...</p>
          <p className="text-sm text-gray-400 mt-2">Please wait while we verify your authentication status</p>
        </div>
      </div>
    );
  };

  // Main menu buttons - centered in the middle of the page with enlarged, well-styled buttons
  const renderMainMenuButtons = () => {
    return (
      <div className="py-16 bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <p className="text-lg text-gray-600">
              Navigate easily to your desired section
            </p>
            <div className="mt-2 text-sm text-gray-500">
              Role: <span className="font-semibold">{role || 'Unknown'}</span> | 
              Status: <span className="font-semibold text-green-600">Ready</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-6">
            {/* Map Button - Always visible */}
            <button
              className="flex flex-col items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-blue-400 hover:to-blue-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-blue-300"
              onClick={() => {
                setShowMap(true);
                setShowListings(false);
                setShowSellerListings(null);
              }}
            >
              <FaMapMarkerAlt className="text-4xl md:text-5xl mb-3" />
              <span className="text-xl md:text-2xl font-bold">Map</span>
            </button>

            {/* Stores Button - Always visible */}
            <button
              className="flex flex-col items-center justify-center bg-gradient-to-br from-cyan-500 to-cyan-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-cyan-400 hover:to-cyan-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-cyan-300"
              onClick={() => {
                setShowBuyerStores(true);
                setShowMap(false);
                setShowListings(false);
                setShowSellerListings(null);
              }}
            >
              <FaStore className="text-4xl md:text-5xl mb-3" />
              <span className="text-xl md:text-2xl font-bold">Stores</span>
            </button>

            {/* Seller-specific buttons */}
            {role === 'seller' && (
              <>
                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-green-500 to-green-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-green-400 hover:to-green-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-green-300"
                  onClick={() => {
                    setShowListings(true);
                    setShowMap(false);
                    setShowSellerListings(null);
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
                  <FaStore className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Listings</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-purple-400 hover:to-purple-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-purple-300"
                  onClick={() => setShowInbox(true)}
                >
                  <FaComments className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Inbox</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-orange-500 to-orange-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-orange-400 hover:to-orange-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-orange-300"
                  onClick={() => setShowSellerOrders(true)}
                >
                  <FaShoppingCart className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Orders</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-pink-500 to-pink-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-pink-400 hover:to-pink-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-pink-300"
                  onClick={() => setShowSellerProfile(true)}
                >
                  <FaUserCheck className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Profile</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-red-500 to-red-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-red-400 hover:to-red-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-red-300"
                  onClick={() => setShowBuyerMap(true)}
                >
                  <FaUserShield className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Buyers</span>
                </button>
              </>
            )}

            {/* Buyer-specific buttons */}
            {role === 'buyer' && (
              <>
                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-indigo-400 hover:to-indigo-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-indigo-300"
                  onClick={() => setShowBuyerMessages(true)}
                >
                  <FaComments className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Messages</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-teal-500 to-teal-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-teal-400 hover:to-teal-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-teal-300"
                  onClick={() => setShowBuyerMyOrders(true)}
                >
                  <FaShoppingCart className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Orders</span>
                </button>

                <button
                  className="flex flex-col items-center justify-center bg-gradient-to-br from-yellow-500 to-yellow-700 text-white font-bold px-6 py-8 md:py-10 rounded-2xl shadow-xl hover:shadow-2xl hover:from-yellow-400 hover:to-yellow-600 transition-all duration-300 transform hover:scale-110 hover:-translate-y-2 min-h-[140px] md:min-h-[160px] border-2 border-yellow-300"
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
                >
                  <FaMapMarkerAlt className="text-4xl md:text-5xl mb-3" />
                  <span className="text-xl md:text-2xl font-bold">Location</span>
                </button>
              </>
            )}
          </div>
        </div>
        
        <DraggableSidebar
          role={role}
          onNavigateToInbox={() => setShowInbox(true)}
          onNavigateToMessages={() => setShowBuyerMessages(true)}
        />
      </div>
    );
  };

  // Simplified footer component
  const renderFooter = () => {
    return null;
  };

  // Show authentication loading state
  if (!authInitialized || roleLoading) {
    return renderAuthLoading();
  }

  // Show main menu only when all conditions are met
  if (shouldShowMainMenu()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center">
        {/* Large, Centered Main Menu Buttons */}
        {renderMainMenuButtons()}
      </div>
    );
  }

  // Show error state if user is signed in but has no role
  if (user && !role && !roleLoading && authInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50">
        <div className="text-center max-w-md">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <strong className="font-bold">Account Setup Required</strong>
            <span className="block sm:inline ml-2">Your account needs to be configured. Please contact support.</span>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Show hero/landing page when not authenticated
  if (!user && !role) {
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
        <div className="fixed bottom-0 left-0 w-full z-50 flex justify-center bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-3 px-2 border-t border-slate-700">
          <button
            className="w-full max-w-xs bg-gray-700 text-white px-6 py-3 rounded-lg text-lg font-semibold shadow hover:bg-gray-800 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ minWidth: '120px' }}
            onClick={() => setShowListings(false)}
          >
            Back to Menu
          </button>
        </div>
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
