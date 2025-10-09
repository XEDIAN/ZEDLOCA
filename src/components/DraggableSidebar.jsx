import React, { useState, useRef, useEffect } from 'react';
import UserProfile from './UserProfile';
import { db, auth } from '../firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

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

function DraggableSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [promotions, setPromotions] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const sidebarRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

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

  // Subscribe to sellers with promotions
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      const promos = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(s => !!s.promo_active && typeof s.promo_radius_meters === 'number');
      setPromotions(promos);
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

  const nearbyPromos = (userLocation)
    ? promotions
        .map(p => ({ ...p, distance: haversine(userLocation.lat, userLocation.lng, p.lat, p.lng) }))
        .filter(p => p.distance <= (p.promo_radius_meters || 0))
        .sort((a, b) => a.distance - b.distance)
    : [];

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-30 transition-opacity duration-300"
          onClick={toggleSidebar}
          aria-label="Close sidebar"
        />
      )}
      <div
        ref={sidebarRef}
        className={`fixed top-0 right-0 h-full z-40 transition-all duration-300 ease-in-out
          ${isOpen
            ? 'bg-white shadow-2xl w-64 sm:w-80 opacity-100'
            : 'bg-white/40 backdrop-blur-md shadow-md w-8 sm:w-12 opacity-70'
          }
        `}
        style={{
          borderTopLeftRadius: isOpen ? '1em' : '1.5em',
          borderBottomLeftRadius: isOpen ? '1em' : '1.5em',
          boxShadow: isOpen ? 'rgba(0,0,0,0.18) -8px 0 24px' : 'rgba(0,0,0,0.08) -2px 0 8px',
          transition: 'all 0.3s cubic-bezier(.4,0,.2,1)'
        }}
      >
        {/* Drag handle */}
        <div
          className="absolute top-0 left-0 h-full w-2 sm:w-2 cursor-col-resize bg-gray-700 hover:bg-gray-600 flex items-center justify-center rounded-l"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-1 h-12 bg-white rounded"></div>
        </div>

        {/* Toggle button */}
        <button
          onClick={toggleSidebar}
          className="absolute top-4 -left-8 w-7 h-10 sm:w-8 sm:h-12 bg-gray-700/80 text-white flex items-center justify-center shadow rounded-l-lg z-50 hover:bg-gray-800/90 transition"
          aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            opacity: isOpen ? 0.7 : 0.5,
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
        </button>

        {/* Sidebar content */}
        <div className={`h-full overflow-y-auto transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="p-2 pt-12 sm:p-4 sm:pt-16">
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
          </div>
        </div>
      </div>
    </>
  );
}

export default DraggableSidebar;