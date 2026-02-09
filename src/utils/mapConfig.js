export const MAP_STYLES = {
  standard: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  watercolor: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg',
};

export const DEFAULT_MAP_STYLE = 'standard';

export const GEOLOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 300000,
};

export const CLUSTER_OPTIONS = {
  chunkedLoading: true,
  spiderfyOnMaxZoom: true,
  showCoverageOnHover: false,
  zoomToBoundsOnClick: true,
  removeOutsideVisibleBounds: true,
  animate: true,
  animateAddingMarkers: true,
  disableClusteringAtZoom: 16,
  maxClusterRadius: 50,
  spiderfyDistanceMultiplier: 1.5,
};

export const HEATMAP_OPTIONS = {
  radius: 25,
  blur: 15,
  maxZoom: 16,
  max: 1.0,
  gradient: {
    0.4: 'blue',
    0.6: 'lime',
    0.8: 'yellow',
    1.0: 'red',
  },
};

export const ROUTING_OPTIONS = {
  routeWhileDragging: false,
  addWaypoints: false,
  draggableWaypoints: false,
  createMarker: () => null,
  lineOptions: {
    styles: [{ color: 'blue', weight: 6, opacity: 0.8 }],
  },
  showAlternatives: false,
  altLineOptions: {
    styles: [{ color: 'gray', weight: 4, opacity: 0.5 }],
  },
};

export const SEARCH_OPTIONS = {
  showMarker: true,
  showPopup: false,
  marker: {
    icon: new L.Icon.Default(),
    draggable: false,
  },
  popupFormat: ({ query, result }) => result.label,
  resultFormat: ({ result }) => result.label,
  title: 'Search for places',
  placeholder: 'Search...',
  maxMarkers: 1,
  retainZoomLevel: false,
  animateZoom: true,
  searchLabel: 'Enter address',
  keepResult: false,
};
