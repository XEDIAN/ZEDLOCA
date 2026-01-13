import { useState, useEffect } from 'react'

function SellerDashboard({ seller }) {
  const [products, setProducts] = useState([])
  const [newProduct, setNewProduct] = useState('')
  const [location, setLocation] = useState(seller.location || [-15.3875, 28.3228])
  const [imageURL, setImageURL] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    const profiles = JSON.parse(localStorage.getItem('sellerProfiles')) || []
    const existing = profiles.find(p => p.email === seller.email)
    if (existing) {
      setProducts(existing.products || [])
      setLocation(existing.location || location)
      setImageURL(existing.image || '')
    }
  }, [seller])

  const saveProfile = () => {
    const updatedProfile = {
      email: seller.email,
      name: seller.name || 'My Shop',
      location,
      products,
      image: imageURL,
    }

    const profiles = JSON.parse(localStorage.getItem('sellerProfiles')) || []
    const others = profiles.filter(p => p.email !== seller.email)
    localStorage.setItem('sellerProfiles', JSON.stringify([...others, updatedProfile]))
    setStatus('Profile saved!')
    setTimeout(() => setStatus(''), 2000)
  }

  const addProduct = () => {
    if (newProduct) {
      setProducts([...products, newProduct])
      setNewProduct('')
    }
  }

  return (
    <div className="bg-white p-6 rounded shadow-md max-w-xl mx-auto mt-8">
      <h2 className="text-2xl font-bold text-center mb-4 text-purple-700">
        Seller Dashboard
      </h2>

      {/* Product Entry */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Add Product</label>
        <input
          type="text"
          value={newProduct}
          onChange={(e) => setNewProduct(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="e.g. Handmade Bag"
        />
        <button
          onClick={addProduct}
          className="mt-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Add to List
        </button>
      </div>

      {/* Product List */}
      {products.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold mb-1 text-gray-600">Your Products:</h3>
          <ul className="list-disc pl-4 text-sm text-gray-800">
            {products.map((product, idx) => (
              <li key={idx}>{product}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Location Input */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Set Location (Lat, Lng)</label>
        <input
          type="text"
          value={location[0]}
          onChange={(e) => setLocation([parseFloat(e.target.value), location[1]])}
          className="w-full mb-2 p-2 border border-gray-300 rounded"
          placeholder="Latitude"
        />
        <input
          type="text"
          value={location[1]}
          onChange={(e) => setLocation([location[0], parseFloat(e.target.value)])}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="Longitude"
        />
      </div>

      {/* Image URL Upload */}
      <div className="mb-4">
        <label className="block mb-1 font-medium text-gray-700">Product Image URL</label>
        <input
          type="text"
          value={imageURL}
          onChange={(e) => setImageURL(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="https://example.com/image.jpg"
        />
        {imageURL && (
          <img src={imageURL} alt="Product Preview" className="mt-2 w-24 h-24 object-cover rounded" />
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={saveProfile}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
      >
        Save Profile
      </button>

      {status && <p className="text-green-500 text-center mt-2">{status}</p>}
    </div>
  )
}

export default SellerDashboard