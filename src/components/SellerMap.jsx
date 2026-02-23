import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useEffect, useState } from 'react'

const sellerIcon = L.icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/854/854878.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

function SellerMap() {
  const [sellers, setSellers] = useState([])

  useEffect(() => {
    const savedSellers = JSON.parse(localStorage.getItem('sellerProfiles')) || []
    setSellers(savedSellers)
  }, [])

  return (
    <div className="w-full h-[500px] rounded-xl shadow-lg overflow-hidden mt-8">
      <MapContainer
        center={[-15.3875, 28.3228]}
        zoom={13}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {sellers.length > 0 ? (
          sellers.map((seller, index) => (
            <Marker key={index} position={seller.location} icon={sellerIcon}>
              <Popup>
                <strong>{seller.name}</strong><br />
                {seller.products?.join(', ') || 'No products listed'}<br />
                {seller.image && (
                  <img
                    src={seller.image}
                    alt="Product"
                    className="mt-2 w-32 h-32 object-cover rounded"
                  />
                )}
              </Popup>
            </Marker>
          ))
        ) : null}
      </MapContainer>
    </div>
  )
}

export default SellerMap