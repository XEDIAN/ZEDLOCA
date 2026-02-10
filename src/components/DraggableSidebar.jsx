import React, { useState, useRef, useEffect } from 'react';
import UserProfile from './UserProfile';
import EditPromotionModal from './EditPromotionModal';
import CurrencySettingsModal from './CurrencySettingsModal';
import LocationSettingsModal from './LocationSettingsModal';
import { db, auth } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, orderBy, limit, doc, updateDoc } from 'firebase/firestore';

const DARK_MODE_KEY = 'darkMode';

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

function DraggableSidebar({ role, onNavigateToInbox, onNavigateToMessages, onNavigateToListings }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSwipeDragging, setIsSwipeDragging] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [listingCount, setListingCount] = useState(0);
  const [analytics, setAnalytics] = useState({ views: 0, messages: 0, viewEvents: [], messageEvents: [] });
  const [buyerUnreadReplies, setBuyerUnreadReplies] = useState(0);
  const [savedSellers, setSavedSellers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [buyerLoading, setBuyerLoading] = useState(false);
  const [buyerError, setBuyerError] = useState(null);
  const [showEditPromotionModal, setShowEditPromotionModal] = useState(false);
  const [showCurrencySettingsModal, setShowCurrencySettingsModal] = useState(false);
  const [showLocationSettingsModal, setShowLocationSettingsModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const swipeStartXRef = useRef(0);
  const swipeStartYRef = useRef(0);

  // Load dark mode preference from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem(DARK_MODE_KEY) === 'true';
    setIsDarkMode(savedDarkMode);
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Fetch seller data if role is seller
  useEffect(() => {
    if (role !== 'seller' || !auth.currentUser) return;

    // Fetch unread messages
    const messagesQuery = query(
      collection(db, 'messages'),
      where('sellerId', '==', auth.currentUser.uid),
      where('read', '==', false),
      where('fromSeller', '==', false)
    );
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      setUnreadMessages(snapshot.size);
    });

    // Fetch listing count
    const listingsQuery = query(
      collection(db, 'listings'),
      where('userId', '==', auth.currentUser.uid)
    );
    const unsubListings = onSnapshot(listingsQuery, (snapshot) => {
      setListingCount(snapshot.size);
    });

    // Fetch analytics (views and messages)
    const analyticsQuery = query(
      collection(db, 'promoEvents'),
      where('sellerId', '==', auth.currentUser.uid)
    );
    const unsubAnalytics = onSnapshot(analyticsQuery, (snapshot) => {
      const events = snapshot.docs.map(doc => doc.data());
      const views = events.filter(e => e.eventType === 'view').length;
      const messages = events.filter(e => e.eventType === 'message').length;
      const viewEvents = events.filter(e => e.eventType === 'view');
      const messageEvents = events.filter(e => e.eventType === 'message');
      setAnalytics({ views, messages, viewEvents, messageEvents });
    });

    return () => {
      unsubMessages();
      unsubListings();
      unsubAnalytics();
    };
  }, [role]);

  const handleDragStart = (e) => {
    setIsDragging(true);
    startXRef.current = e.clientX || e.touches?.[0].clientX || 0;
    startWidthRef.current = sidebarRef.current?.offsetWidth || 0;
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none';
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    const clientX = e.clientX || e.touches?.[0].clientX || 0;
    const diff = startXRef.current - clientX;
    const newWidth = Math.max(250, Math.min(500, startWidthRef.current + diff));
    
    if (sidebarRef.current) {
      sidebarRef.current.style.width = `${newWidth}px`;
    }
    
    // Update open state based on width
    setIsOpen(newWidth > 250);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    
    // Reset styles
    document.body.style.userSelect = '';
    document.body.style.pointerEvents = '';
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('touchmove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  // Subscribe to listings with promotions
  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('promo_active', '==', true)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const promoListings = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setPromotions(promoListings);
    }, (err) => {
      console.error('Failed to load promotions:', err);
      setPromotions([]);
    });
    return () => unsub();
  }, []);

  // Get user location (precise if possible, fallback null)
  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          // ignore error; keep userLocation null so we can show nothing or all promos
          setUserLocation(null);
        },
        { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
      );
    }
    return () => { cancelled = true; };
  }, []);

  // Fetch seller-specific data if user is a seller
  useEffect(() => {
    if (role !== 'seller' || !auth?.currentUser?.uid) return;

    const userId = auth.currentUser.uid;

    // Fetch unread messages count
    const messagesQuery = query(
      collection(db, 'messages'),
      where('sellerId', '==', userId),
      where('read', '==', false)
    );
    const unsubMessages = onSnapshot(messagesQuery, (snapshot) => {
      setUnreadMessages(snapshot.size);
    }, (err) => {
      console.error('Failed to load unread messages:', err);
      setUnreadMessages(0);
    });

    // Fetch listing count
    const listingsQuery = query(
      collection(db, 'listings'),
      where('userId', '==', userId)
    );
    const unsubListings = onSnapshot(listingsQuery, (snapshot) => {
      setListingCount(snapshot.size);
    }, (err) => {
      console.error('Failed to load listing count:', err);
      setListingCount(0);
    });

    // Fetch analytics (views and messages from promoEvents)
    const analyticsQuery = query(
      collection(db, 'promoEvents'),
      where('sellerId', '==', userId)
    );
    const unsubAnalytics = onSnapshot(analyticsQuery, (snapshot) => {
      const events = snapshot.docs.map(d => d.data());
      const views = events.filter(e => e.eventType === 'view').length;
      const messages = events.filter(e => e.eventType === 'message').length;
      const viewEvents = events.filter(e => e.eventType === 'view');
      const messageEvents = events.filter(e => e.eventType === 'message');
      setAnalytics({ views, messages, viewEvents, messageEvents });
    }, (err) => {
      console.error('Failed to load analytics:', err);
      setAnalytics({ views: 0, messages: 0, viewEvents: [], messageEvents: [] });
    });

    return () => {
      unsubMessages();
      unsubListings();
      unsubAnalytics();
    };
  }, [role]);

  // Load saved sellers from local storage for buyers
  useEffect(() => {
    if (role === 'buyer' && auth?.currentUser?.uid) {
      const userId = auth.currentUser.uid;
      const savedKey = `savedSellers_${userId}`;
      const saved = JSON.parse(localStorage.getItem(savedKey) || '[]');
      setSavedSellers(saved);
    }
  }, [role, auth?.currentUser?.uid]);

  // Fetch buyer-specific data if user is a buyer
  useEffect(() => {
    if (role !== 'buyer' || !auth?.currentUser?.uid) return;

    const userId = auth.currentUser.uid;

    // Fetch unread replies count (messages from sellers to this buyer)
    const repliesQuery = query(
      collection(db, 'messages'),
      where('buyerId', '==', userId),
      where('fromSeller', '==', true),
      where('read', '==', false)
    );
    const unsubReplies = onSnapshot(repliesQuery, (snapshot) => {
      setBuyerUnreadReplies(snapshot.size);
    }, (err) => {
      console.error('Failed to load unread replies:', err);
      setBuyerUnreadReplies(0);
    });

    // Fetch recent activity (recent promoEvents where this buyer viewed promotions)
    const activityQuery = query(
      collection(db, 'promoEvents'),
      where('userId', '==', userId),
      where('eventType', '==', 'view'),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    const unsubActivity = onSnapshot(activityQuery, (snapshot) => {
      const activities = snapshot.docs.map(d => d.data());
      setRecentActivity(activities);
    }, (err) => {
      console.error('Failed to load recent activity:', err);
      setRecentActivity([]);
    });

    return () => {
      unsubReplies();
      unsubActivity();
    };
  }, [role]);

  const nearbyPromos = (userLocation)
    ? promotions
        .map(p => ({ ...p, distance: haversine(userLocation.lat, userLocation.lng, p.lat, p.lng) }))
        .filter(p => p.distance <= (p.promo_radius_meters || 0))
        .sort((a, b) => a.distance - b.distance)
    : [];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const toggleDarkMode = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    localStorage.setItem(DARK_MODE_KEY, newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Swipe gesture handlers
  const handleSwipeStart = (e) => {
    const clientX = e.touches?.[0].clientX || e.clientX;
    const clientY = e.touches?.[0].clientY || e.clientY;

    swipeStartXRef.current = clientX;
    swipeStartYRef.current = clientY;
    setIsSwipeDragging(true);
  };

  const handleSwipeMove = (e) => {
    if (!isSwipeDragging) return;

    const clientX = e.touches?.[0].clientX || e.clientX;
    const clientY = e.touches?.[0].clientY || e.clientY;

    const deltaX = clientX - swipeStartXRef.current;
    const deltaY = clientY - swipeStartYRef.current;

    // Check if it's a horizontal swipe (more horizontal than vertical)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      e.preventDefault(); // Prevent scrolling

      if (!isOpen && deltaX < -50) {
        // Swipe left from right edge to open
        setIsOpen(true);
        setIsSwipeDragging(false);
      } else if (isOpen && deltaX > 50) {
        // Swipe right to close
        setIsOpen(false);
        setIsSwipeDragging(false);
      }
    }
  };

  const handleSwipeEnd = () => {
    setIsSwipeDragging(false);
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className={`fixed inset-0 backdrop-blur-md z-30 transition-opacity duration-300 ${role === 'seller' ? 'pointer-events-none' : ''}`}
          {...(role !== 'seller' && { onClick: toggleSidebar })}
          aria-label="Close sidebar"
        />
      )}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full z-40 transition-all duration-300 ease-in-out
          ${isOpen
            ? 'bg-white shadow-2xl w-64 sm:w-80 opacity-100'
            : 'bg-white/40 backdrop-blur-md shadow-md w-0 sm:w-8 md:w-12 opacity-70'
          }
        `}
        style={{
          borderTopLeftRadius: isOpen ? '1em' : '1.5em',
          borderBottomLeftRadius: isOpen ? '1em' : '1.5em',
          boxShadow: isOpen ? 'rgba(0,0,0,0.18) -8px 0 24px' : 'rgba(0,0,0,0.08) -2px 0 8px',
          transition: 'all 0.3s cubic-bezier(.4,0,.2,1)'
        }}
        {...(role !== 'seller' && {
          onTouchStart: handleSwipeStart,
          onTouchMove: handleSwipeMove,
          onTouchEnd: handleSwipeEnd,
          onMouseDown: handleSwipeStart,
          onMouseMove: handleSwipeMove,
          onMouseUp: handleSwipeEnd
        })}
      >
        {/* Drag handle */}
        <div
          className={`absolute top-0 left-0 h-full w-2 sm:w-2 cursor-col-resize bg-gray-700 hover:bg-gray-600 flex items-center justify-center rounded-l ${role === 'seller' ? 'pointer-events-none opacity-50' : ''}`}
          {...(role !== 'seller' && {
            onMouseDown: handleDragStart,
            onTouchStart: handleDragStart
          })}
        >
          <div className="w-1 h-12 bg-white rounded"></div>
        </div>

        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute top-1/2 -translate-y-1/2 -left-3 sm:-left-4 w-5 h-6 sm:w-7 sm:h-10 bg-gray-700/80 text-white flex items-center justify-center shadow rounded-l-lg z-50 hover:bg-gray-800/90 transition"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            opacity: isOpen ? 0.7 : 0.8,
            borderTopLeftRadius: '1em',
            borderBottomLeftRadius: '1em'
          }}
        >
          {isOpen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
          {role === 'buyer' && buyerUnreadReplies > 0 && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-white"></div>
          )}
          {role === 'buyer' && savedSellers.length > 0 && (
            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-500 rounded-full border border-white"></div>
          )}
        </button>

        {/* Sidebar content */}
        <div className={`h-full overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="p-2 pt-12 sm:p-4 sm:pt-16">
            {role === 'seller' ? (
              <>
                {/* Seller-specific sections */}
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Inbox Overview</h2>
                  <div
                    className="p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => onNavigateToInbox && onNavigateToInbox()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">📬</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Unread Messages</p>
                          <p className="text-xs text-gray-600">From buyers</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${unreadMessages > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {unreadMessages}
                        </span>
                        {unreadMessages > 0 && (
                          <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">My Listings</h2>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🏪</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Active Listings</p>
                          <p className="text-xs text-gray-600">Total products</p>
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-600">{listingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Analytics</h2>
                  <div className="space-y-2">
                    <div
                      className="p-3 bg-purple-50 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
                      onClick={() => {
                        const viewerIds = analytics.viewEvents.map(event => event.userId).filter(id => id);
                        const uniqueViewers = [...new Set(viewerIds)];
                        const message = `Promotion Views: ${analytics.views}\n\nViewers: ${uniqueViewers.length > 0 ? uniqueViewers.join(', ') : 'No viewers yet'}\n\nThis shows how many times buyers viewed your promotions.`;
                        alert(message);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">👁️</span>
                          <p className="font-semibold text-sm text-black">Promotion Views</p>
                        </div>
                        <span className="text-lg font-bold text-purple-600">{analytics.views}</span>
                      </div>
                    </div>
                    <div
                      className="p-3 bg-orange-50 rounded-lg border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                      onClick={() => onNavigateToInbox && onNavigateToInbox()}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">💬</span>
                          <p className="font-semibold text-sm text-black">Messages Received</p>
                        </div>
                        <span className="text-lg font-bold text-orange-600">{analytics.messages}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Seller Tools</h2>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowEditPromotionModal(true)}
                      className="w-full p-3 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">✏️</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Edit Promotion</p>
                          <p className="text-xs text-gray-600">Update your current offer</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={async () => {
                        if (!auth?.currentUser?.uid) {
                          alert('Please log in to update your location.');
                          return;
                        }

                        if (!navigator.geolocation) {
                          alert('Geolocation is not supported by this browser.');
                          return;
                        }

                        try {
                          const position = await new Promise((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, {
                              enableHighAccuracy: true,
                              timeout: 10000,
                              maximumAge: 0
                            });
                          });

                          const { latitude, longitude } = position.coords;
                          const sellerRef = doc(db, 'sellers', auth.currentUser.uid);

                          await updateDoc(sellerRef, {
                            lat: latitude,
                            lng: longitude,
                            updatedAt: serverTimestamp()
                          });

                          alert(`Location updated successfully!\nLatitude: ${latitude.toFixed(6)}\nLongitude: ${longitude.toFixed(6)}`);
                        } catch (error) {
                          console.error('Error updating location:', error);
                          if (error.code === error.PERMISSION_DENIED) {
                            alert('Location access denied. Please enable location permissions and try again.');
                          } else if (error.code === error.POSITION_UNAVAILABLE) {
                            alert('Location information is unavailable. Please try again.');
                          } else if (error.code === error.TIMEOUT) {
                            alert('Location request timed out. Please try again.');
                          } else {
                            alert('Failed to update location. Please try again.');
                          }
                        }
                      }}
                      className="w-full p-3 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📍</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Update Store Location</p>
                          <p className="text-xs text-gray-600">Fetch real-time location</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={toggleDarkMode}
                      className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{isDarkMode ? '☀️' : '🌙'}</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Dark Mode</p>
                          <p className="text-xs text-gray-600">{isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">Nearby Promotions</h2>
                {nearbyPromos.length === 0 ? (
                  <p className="text-sm text-gray-600 mb-3">No nearby promotions right now.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {nearbyPromos.map(promo => (
                      <div key={promo.id} className="p-2 bg-gray-50 rounded shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">{promo.displayName || 'Seller'}</h3>
                            <p className="text-xs text-gray-600">{promo.promo_text}</p>
                            <p className="text-xs text-gray-400 mt-1">{Math.round(promo.distance)} m away</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await addDoc(collection(db, 'promoEvents'), {
                                    sellerId: promo.id,
                                    userId: auth?.currentUser?.uid || null,
                                    eventType: 'view',
                                    distance: Math.round(promo.distance),
                                    timestamp: serverTimestamp(),
                                  });
                                } catch (err) {
                                  console.error('Failed to log promo view:', err);
                                }
                                alert(`Viewing promotion from ${promo.displayName || 'Seller'}: ${promo.promo_text}`);
                              }}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">Profile</h2>
                <UserProfile />
              </>
            ) : (
              <>
                {/* Buyer-specific sections */}
                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Messages</h2>
                  <div
                    className="p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                    onClick={() => onNavigateToMessages && onNavigateToMessages()}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">💬</span>
                        <div>
                          <p className="font-semibold text-sm">Unread Replies</p>
                          <p className="text-xs text-gray-600">From sellers</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${buyerUnreadReplies > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {buyerUnreadReplies}
                        </span>
                        {buyerUnreadReplies > 0 && (
                          <div className="w-2 h-2 bg-red-500 rounded-full mx-auto mt-1"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Saved Sellers</h2>
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⭐</span>
                        <div>
                          <p className="font-semibold text-sm">Favorite Stores</p>
                          <p className="text-xs text-gray-600">Quick access to preferred sellers</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${savedSellers.length > 0 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {savedSellers.length}
                        </span>
                        {savedSellers.length > 0 && (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mx-auto mt-1"></div>
                        )}
                      </div>
                    </div>
                    {savedSellers.length === 0 ? (
                      <p className="text-xs text-gray-500 mt-2">No saved sellers yet</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {savedSellers.slice(0, 3).map(seller => (
                          <div key={seller.id} className="text-xs bg-white p-2 rounded">
                            {seller.displayName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Recent Activity</h2>
                  <div className="space-y-2">
                    {recentActivity.length === 0 ? (
                      <p className="text-sm text-gray-600">No recent activity</p>
                    ) : (
                      recentActivity.map((activity, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                          <p className="font-medium">Viewed promotion</p>
                          <p className="text-gray-600">{Math.round(activity.distance)}m away</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h2 className="text-lg sm:text-xl font-bold mb-3 text-gray-800">Buyer Tools</h2>
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowCurrencySettingsModal(true)}
                      className="w-full p-3 bg-yellow-50 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💱</span>
                        <div>
                          <p className="font-semibold text-sm">Currency Settings</p>
                          <p className="text-xs text-gray-600">Change display currency</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setShowLocationSettingsModal(true)}
                      className="w-full p-3 bg-indigo-50 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📍</span>
                        <div>
                          <p className="font-semibold text-sm">Location Settings</p>
                          <p className="text-xs text-gray-600">Update search preferences</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={toggleDarkMode}
                      className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{isDarkMode ? '☀️' : '🌙'}</span>
                        <div>
                          <p className="font-semibold text-sm text-black">Dark Mode</p>
                          <p className="text-xs text-gray-600">{isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">Nearby Promotions</h2>
                {nearbyPromos.length === 0 ? (
                  <p className="text-sm text-gray-600 mb-3">No nearby promotions right now.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {nearbyPromos.map(promo => (
                      <div key={promo.id} className="p-2 bg-gray-50 rounded shadow-sm">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold text-sm">{promo.displayName || 'Seller'}</h3>
                            <p className="text-xs text-gray-600">{promo.promo_text}</p>
                            <p className="text-xs text-gray-400 mt-1">{Math.round(promo.distance)} m away</p>
                          </div>
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={async () => {
                                try {
                                  await addDoc(collection(db, 'promoEvents'), {
                                    sellerId: promo.id,
                                    userId: auth?.currentUser?.uid || null,
                                    eventType: 'view',
                                    distance: Math.round(promo.distance),
                                    timestamp: serverTimestamp(),
                                  });
                                } catch (err) {
                                  console.error('Failed to log promo view:', err);
                                }
                                alert(`Viewing promotion from ${promo.displayName || 'Seller'}: ${promo.promo_text}`);
                              }}
                              className="bg-blue-600 text-white px-2 py-1 rounded text-xs"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                // Add to saved sellers (local storage for now)
                                const userId = auth?.currentUser?.uid;
                                if (userId) {
                                  const savedKey = `savedSellers_${userId}`;
                                  const currentSaved = JSON.parse(localStorage.getItem(savedKey) || '[]');
                                  if (!currentSaved.find(s => s.id === promo.id)) {
                                    const newSeller = { id: promo.id, displayName: promo.displayName || 'Seller' };
                                    currentSaved.push(newSeller);
                                    localStorage.setItem(savedKey, JSON.stringify(currentSaved));
                                    setSavedSellers(currentSaved); // Update state immediately
                                    alert('Seller saved!');
                                  } else {
                                    alert('Seller already saved!');
                                  }
                                }
                              }}
                              className="bg-gray-600 text-white px-2 py-1 rounded text-xs"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-gray-800">Profile</h2>
                <UserProfile />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Promotion Modal */}
      {showEditPromotionModal && (
        <EditPromotionModal
          onClose={() => setShowEditPromotionModal(false)}
        />
      )}

      {/* Currency Settings Modal */}
      {showCurrencySettingsModal && (
        <CurrencySettingsModal
          onClose={() => setShowCurrencySettingsModal(false)}
        />
      )}

      {/* Location Settings Modal */}
      {showLocationSettingsModal && (
        <LocationSettingsModal
          onClose={() => setShowLocationSettingsModal(false)}
        />
      )}
    </>
  );
}

export default DraggableSidebar;
