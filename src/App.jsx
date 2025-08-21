import React from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  return (
    <div className="h-screen w-screen relative">
      <h1 className="text-3xl font-bold absolute top-0 left-0 p-4 text-white bg-gray-900 z-20">
        WELCOME TO ZEDLOCA MARKET PLACE
      </h1>
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
      </MapContainer>
    </div>
  );
}

export default App;

