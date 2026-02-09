import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { db, auth } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import MessageSellerModal from './MessageSellerModal';
import MapControls from './MapControls';
import DraggableSidebar from './DraggableSidebar';
import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import 'leaflet.heat';
import 'leaflet-routing-machine';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';
import 'leaflet-geosearch/dist/geosearch.css';
import { FixedSizeList as List } from 'react-window';
import {
  MAP_STYLES,
  DEFAULT_MAP_STYLE,
  GEOLOCATION_OPTIONS,
  CLUSTER_OPTIONS,
  HEATMAP_OPTIONS,
  ROUTING_OPTIONS,
  SEARCH_OPTIONS
} from '../utils/mapConfig';

// Custom icons
const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;
const sellerIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/190/190411.png',
  iconSize: isMobile ? [22, 22] : [32, 32],
  iconAnchor: isMobile ? [11, 22] : [16, 32],
  popupAnchor: isMobile ? [0, -22] : [0, -32],
});

const promotedIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/616/616490.png',
  iconSize: isMobile ? [24, 24] : [36, 36],
  iconAnchor: isMobile ? [12, 24] : [18, 36],
  popupAnchor: isMobile ? [0, -24] : [0, -36],
});

const userLocationIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Haversine distance calculation
function haversine(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => typeof v !== 'number')) return Infinity;
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Map event handler component
function MapEventHandler({ onLocationFound, onZoomChange }) {
  const map = useMap();

  useMapEvents({
    locationfound: (e) => {
      onLocationFound(e.latlng);
    },
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  return null;
}

// Search control component
function SearchControl({ onLocationSelect }) {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider,
      ...SEARCH_OPTIONS,
      style: 'bar',
    });

    map.addControl(searchControl);

    map.on('geosearch/showlocation', (result) => {
      onLocationSelect(result.location);
    });

    return () => {
      map.removeControl(searchControl);
    };
  }, [map, onLocationSelect]);

  return null;
}

// Routing control component
function RoutingControl({ waypoints, isActive, onRouteFound }) {
  const map = useMap();

  useEffect(() => {
    if (!isActive || waypoints.length < 2) return;

    const routingControl = L.Routing.control({
      waypoints: waypoints.map(wp => L.latLng(wp.lat, wp.lng)),
      ...ROUTING_OPTIONS,
      createMarker: () => null, // Don't create default markers
    }).addTo(map);

    routingControl.on('routesfound', (e) => {
      const route = e.routes[0];
      onRouteFound(route);
    });

    return () => {
      map.removeControl(routingControl);
    };
  }, [map, waypoints, isActive, onRouteFound]);

  return null;
}

// Heatmap layer component
function HeatmapLayer({ sellers, isVisible }) {
  const map = useMap();

  useEffect(() => {
    if (!isVisible) return;

    const heatData = sellers
      .filter(s => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map(s => [s.lat, s.lng, 0.5]); // intensity

    const heatLayer = L.heatLayer(heatData, HEATMAP_OPTIONS).addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [map, sellers, isVisible]);

  return null;
}

// Marker cluster component
function MarkerCluster({ sellers, userLocation, onViewStore, messageModal, setMessageModal, onNavigate, clusterMarkers }) {
  const map = useMap();
  const markersRef = useRef(new L.MarkerClusterGroup(CLUSTER_OPTIONS));

  useEffect(() => {
    const markers = markersRef.current;

    // Clear existing markers
    markers.clearLayers();

    // Add new markers
    sellers
      .filter(seller => typeof seller.lat === 'number' && typeof seller.lng === 'number')
      .forEach(seller => {
        const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : Infinity;
        const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;
        const icon = promoActive ? promotedIcon : sellerIcon;

        const marker = L.marker([seller.lat, seller.lng], { icon });

        const popupContent = `
          <div class="p-2 max-w-xs">
            <div class="flex items-center mb-2">
              <span class="text-2xl mr-2">🏪</span>
              <div>
                <h3 class="font-semibold text-gray-900">${seller.displayName || 'Seller'}</h3>
                ${promoActive ? '<span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Promotion</span>' : ''}
              </div>
            </div>
            ${promoActive && seller.promo_text ? `<p class="text-sm text-gray-600 mb-3 italic">"${seller.promo_text}"</p>` : ''}
            ${userLocation ? `<p class="text-xs text-gray-500 mb-3">📍 ${(distanceToUser / 1000).toFixed(1)} km away</p>` : ''}
            <div class="flex flex-col gap-2">
              <button class="view-store-btn w-full bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors" data-seller-id="${seller.id}">
                View Store
              </button>
              <button class="message-btn w-full bg-green-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-green-700 transition-colors" data-seller-id="${seller.id}">
                Message
              </button>
              ${seller.phone ? `<a href="tel:${seller.phone}" class="w-full bg-purple-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-purple-700 transition-colors text-center block">📞 Call</a>` : ''}
              <button class="navigate-btn w-full bg-red-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-red-700 transition-colors" data-seller-id="${seller.id}" title="Get directions to this seller">
                🗺️ Navigate
              </button>
            </div>
          </div>
        `;

        marker.bindPopup(popupContent);

        // Add event listeners to popup buttons
        marker.on('popupopen', () => {
          const popup = marker.getPopup();
          const container = popup.getElement();

          container.querySelector('.view-store-btn')?.addEventListener('click', () => {
            onViewStore(seller.id);
            map.closePopup();
          });

          container.querySelector('.message-btn')?.addEventListener('click', () => {
            setMessageModal({ open: true, seller });
            map.closePopup();
          });

          container.querySelector('.navigate-btn')?.addEventListener('click', () => {
            onNavigate(seller);
            map.closePopup();
          });
        });

        markers.addLayer(marker);
      });

    // Add markers to map if clustering is enabled
    if (clusterMarkers) {
      map.addLayer(markers);
    }

    return () => {
      if (clusterMarkers) {
        map.removeLayer(markers);
      }
    };
  }, [map, sellers, userLocation, onViewStore, messageModal, setMessageModal, onNavigate, clusterMarkers]);

  return null;
}

// Virtualized list item component
const ListItem = React.memo(({ index, style, data }) => {
  const { sellers, userLocation, onViewStore, setMessageModal, onNavigate } = data;
  const seller = sellers[index];

  const distanceToUser = userLocation ? haversine(userLocation.lat, userLocation.lng, seller.lat, seller.lng) : null;
  const promoActive = !!seller.promo_active && typeof seller.promo_radius_meters === 'number' && distanceToUser <= seller.promo_radius_meters;

  return (
    <div style={style} className="px-4 py-2">
      <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <span className="text-2xl mr-3">🏪</span>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{seller.displayName || 'Seller'}</h3>
                {promoActive && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">Promotion</span>}
              </div>
            </div>

            {promoActive && seller.promo_text && (
              <p className="text-gray-600 mb-3 italic">"{seller.promo_text}"</p>
            )}

            <div className="flex items-center text-sm text-gray-500 mb-3">
              {distanceToUser && (
                <span className="mr-4">📍 {(distanceToUser / 1000).toFixed(1)} km away</span>
              )}
              {seller.category && (
                <span className="bg-gray-100 px-2 py-1 rounded">{seller.category}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4">
            <div className="flex gap-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                onClick={() => onViewStore(seller.id)}
              >
                View Store
              </button>
              <button
                className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                onClick={() => setMessageModal({ open: true, seller })}
              >
                Message
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {seller.phone && (
                <a
                  href={`tel:${seller.phone}`}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors text-center block"
                >
                  📞 Call
                </a>
              )}
              <button
                className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                onClick={() => onNavigate(seller)}
                title="Get directions to this seller"
              >
                🗺️ Navigate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

function MapViewEnhanced({ onViewStore, onBack, role, onNavigateToInbox, onNavigateToMessages }) {
  const [sellers, setSellers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [messageModal, setMessageModal] = useState({ open: false, seller: null });
  const [viewMode, setViewMode] = useState('map');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('distance');
  const [loading, setLoading] = useState(true);
  const [mapStyle, setMapStyle] = useState(DEFAULT_MAP_STYLE);
  const [currentZoom, setCurrentZoom] = useState(13);
  const [clusterMarkers, setClusterMarkers] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
