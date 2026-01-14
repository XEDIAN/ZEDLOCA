import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { useCurrency } from '../components/CurrencyContext';

function PlaceOrderPage({ listing, seller, buyer, onBack }) {
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [deliveryOption, setDeliveryOption] = useState('standard');
  const [contactInfo, setContactInfo] = useState('');
  const [enableTracking, setEnableTracking] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Automatically prompt for location when page opens (optional for pickup)
  useEffect(() => {
    if (!location && !locationError && deliveryOption !== 'pickup') {
      setLocationLoading(true);
      getLocation()
        .then((userLocation) => {
          setLocation(userLocation);
          setLocationLoading(false);
        })
        .catch((err) => {
          console.error('Error getting location:', err);
          if (err.isGeolocationError) {
            setLocationError('Location access would help with delivery coordination, but you can still place your order.');
          } else {
            setLocationError('Unable to access your location. You can still place your order.');
          }
          setLocationLoading(false);
        });
    }
  }, [location, locationError, deliveryOption]);

  // Automatically fill delivery address from buyer's location
  useEffect(() => {
    const fetchBuyerLocation = async () => {
      if (buyer && buyer.uid && !deliveryAddress) {
        try {
          const buyerDoc = await getDoc(doc(db, 'users', buyer.uid));
          if (buyerDoc.exists()) {
            const buyerData = buyerDoc.data();
            if (buyerData.location) {
              setDeliveryAddress(buyerData.location);
            }
          }
        } catch (error) {
          console.error('Error fetching buyer location:', error);
        }
      }
    };

    fetchBuyerLocation();
  }, [buyer, deliveryAddress]);

  const getLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          // Create a custom error with geolocation flag
          const geoError = new Error(`Geolocation error: ${error.message}`);
          geoError.isGeolocationError = true;
          reject(geoError);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  // Constants for calculations
  const taxRate = 0.08; // 8% tax
  const deliveryFees = {
    standard: 5.00,
    express: 10.00,
    pickup: 0.00
  };
  const estimatedDeliveryTimes = {
    standard: '3-5 business days',
    express: '1-2 business days',
    pickup: 'Ready for pickup within 24 hours'
  };

  // Calculations
  const itemPrice = parseFloat(listing.price.replace(/[^0-9.-]+/g, ''));
  const subtotal = itemPrice * quantity;
  const deliveryFee = deliveryFees[deliveryOption];
  const tax = (subtotal + deliveryFee) * taxRate;
  const total = subtotal + deliveryFee + tax;

  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    if (!deliveryAddress.trim()) {
      setError('Please provide a delivery address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const orderData = {
        listingId: listing.id,
        sellerId: seller.id,
        buyerId: buyer.uid,
        title: listing.title,
        price: listing.price,
        quantity: quantity,
        totalPrice: parseFloat(listing.price.replace(/[^0-9.-]+/g, '')) * quantity,
        deliveryAddress: deliveryAddress.trim(),
        specialInstructions: specialInstructions.trim(),
        buyerLocation: location, // Optional location for delivery coordination
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'orders'), orderData);
      setSuccess(true);

      // Reset form
      setQuantity(1);
      setDeliveryAddress('');
      setSpecialInstructions('');
      setLocation(null);
    } catch (err) {
      console.error('Error placing order:', err);
      setError('Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-green-400 via-blue-300 to-purple-500">
        <div className="flex-1 flex flex-col items-center justify-center pb-32">
          <div className="w-full max-w-2xl px-4">
            <div className="bg-white rounded-xl p-8 shadow-xl text-center">
              <div className="text-6xl mb-4">✅</div>
              <h1 className="text-3xl font-bold text-gray-800 mb-4">Order Placed Successfully!</h1>
              <p className="text-gray-600 mb-6">
                Your order has been sent to the seller. They will contact you soon to arrange delivery.
              </p>
              <button
                onClick={onBack}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Back to Stores
              </button>
            </div>
          </div>
        </div>
        <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 text-white py-6 flex justify-center gap-4 z-50 shadow-2xl">
          <button
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
            onClick={onBack}
          >
            <span className="text-xl">⬅️</span>
            Back to Stores
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-between relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10"></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.3),transparent_50%)]"></div>
        <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.2),transparent_50%)]"></div>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center pb-32">
        <div className="w-full max-w-6xl px-4">
          {/* Header Section with Glass Effect */}
          <div className="text-center mb-8">
            <div className="inline-block backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
              <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3 drop-shadow-lg">
                <span className="text-3xl">🛒</span>
                Place Your Order
              </h1>
              <p className="text-white/80">Complete your purchase securely and easily</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Product Summary Card with Glassmorphism */}
            <div className="lg:col-span-1">
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 hover:shadow-purple-500/25 hover:border-white/30">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                    <span className="text-white text-xl">📦</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Product Details</h2>
                    <p className="text-sm text-gray-500">Review your selection</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-b border-gray-100 pb-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{listing.title}</h3>
                    <p className="text-gray-600 text-sm mb-3">{listing.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-green-600">{formatPrice(listing.price)}</span>
                      <span className="text-sm text-gray-500">per item</span>
                    </div>
                    {listing.category && (
                      <span className="inline-block bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full mt-2 font-medium">
                        {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                      </span>
                    )}
                  </div>

                  {/* Seller Info Card */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-lg">👤</span>
                      Seller Information
                    </h4>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {seller.photoURL ? (
                          <img
                            src={seller.photoURL}
                            alt={seller.displayName}
                            className="w-10 h-10 rounded-full border-2 border-blue-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                            <span className="text-sm text-white font-bold">
                              {seller.displayName?.charAt(0)?.toUpperCase() || 'S'}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{seller.displayName}</div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className="text-yellow-400 text-xs">⭐</span>
                          ))}
                          <span className="text-xs text-gray-600 ml-1">(4.8)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Form Cards */}
            <div className="lg:col-span-2 space-y-6">
              {/* Quantity & Payment Card with Glassmorphism */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 hover:shadow-green-500/25 hover:border-white/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">⚙️</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Order Configuration</h2>
                    <p className="text-sm text-white/80">Set your preferences</p>
                  </div>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-red-500">⚠️</span>
                      <div className="text-red-700 text-sm font-medium">{error}</div>
                    </div>
                  </div>
                )}

                {locationError && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                    <div className="flex items-center gap-2">
                      <span className="text-orange-500">📍</span>
                      <div className="text-orange-700 text-sm font-medium">{locationError}</div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmitOrder} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="cash">💵 Cash on Delivery</option>
                        <option value="card">💳 Credit/Debit Card</option>
                        <option value="paypal">🅿️ PayPal</option>
                        <option value="bank">🏦 Bank Transfer</option>
                      </select>
                    </div>
                  </div>
                </form>
              </div>

              {/* Delivery Options Card with Glassmorphism */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 hover:shadow-orange-500/25 hover:border-white/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">🚚</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Delivery Options</h2>
                    <p className="text-sm text-white/80">Choose your delivery method</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(deliveryFees).map(([option, fee]) => (
                    <label key={option} className="flex items-center p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer">
                      <input
                        type="radio"
                        name="deliveryOption"
                        value={option}
                        checked={deliveryOption === option}
                        onChange={(e) => setDeliveryOption(e.target.value)}
                        className="mr-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900 capitalize">{option}</span>
                          <span className="text-sm font-semibold text-green-600">
                            {fee === 0 ? 'Free' : formatPrice(fee.toString())}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{estimatedDeliveryTimes[option]}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delivery Details Card with Glassmorphism */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 hover:shadow-purple-500/25 hover:border-white/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">📍</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Delivery Details</h2>
                    <p className="text-sm text-white/80">Where should we deliver?</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Delivery Address *
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your full delivery address including street, city, and postal code"
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                      required
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Contact Information (Optional)
                      </label>
                      <input
                        type="tel"
                        value={contactInfo}
                        onChange={(e) => setContactInfo(e.target.value)}
                        placeholder="Phone number for delivery updates"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Special Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Any special delivery notes"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex items-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <input
                      type="checkbox"
                      id="enableTracking"
                      checked={enableTracking}
                      onChange={(e) => setEnableTracking(e.target.checked)}
                      className="mr-3 text-blue-600 focus:ring-blue-500 rounded"
                    />
                    <label htmlFor="enableTracking" className="text-sm text-gray-700 font-medium cursor-pointer">
                      📱 Enable order tracking notifications
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Summary Card with Glassmorphism */}
              <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-6 shadow-2xl hover:bg-white/15 transition-all duration-300 hover:shadow-emerald-500/25 hover:border-white/30">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-white text-xl">💰</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Order Summary</h2>
                    <p className="text-sm text-white/80">Review your order details</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Price per item:</span>
                    <span className="font-medium">{formatPrice(listing.price)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium">{quantity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{formatPrice(subtotal.toString())}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Delivery Fee:</span>
                    <span className="font-medium">{formatPrice(deliveryFee.toString())}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Tax (8%):</span>
                    <span className="font-medium">{formatPrice(tax.toFixed(2))}</span>
                  </div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-gray-900">Total:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatPrice(total.toFixed(2))}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-8 py-4 rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
                  onClick={handleSubmitOrder}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🛒</span>
                      Place Order - {formatPrice(total.toFixed(2))}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 w-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-900 text-white py-6 flex justify-center gap-4 z-50 shadow-2xl">
        <button
          className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center gap-2"
          onClick={onBack}
        >
          <span className="text-xl">⬅️</span>
          Back to Stores
        </button>
      </footer>
    </div>
  );
}

export default PlaceOrderPage;
