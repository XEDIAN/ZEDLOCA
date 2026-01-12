import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-teal-400 via-blue-300 to-purple-500">
      <div className="flex-1 flex flex-col items-center justify-center pb-32">
        <div className="w-full max-w-4xl px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Order Summary */}
            <div className="md:w-1/2">
              <div className="bg-white rounded-xl p-6 shadow-xl mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <span className="text-2xl">🛒</span>
                  Place Your Order
                </h1>

                {/* Listing Details */}
                <div className="border-b border-gray-200 pb-4 mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">{listing.title}</h2>
                  <p className="text-gray-600 text-sm mb-2">{listing.description}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-600 font-bold text-lg">{formatPrice(listing.price)}</span>
                    <span className="text-gray-500">per item</span>
                  </div>
                  {listing.category && (
                    <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                      {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                    </span>
                  )}
                </div>

                {/* Seller Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative">
                    {seller.photoURL ? (
                      <img
                        src={seller.photoURL}
                        alt={seller.displayName}
                        className="w-12 h-12 rounded-full border-2 border-teal-400"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-teal-400 to-purple-500 flex items-center justify-center">
                        <span className="text-sm text-white font-bold">
                          {seller.displayName?.charAt(0)?.toUpperCase() || 'S'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">{seller.displayName}</div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className="text-yellow-400 text-xs">⭐</span>
                      ))}
                      <span className="text-xs text-gray-600">(4.8)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Form */}
            <div className="md:w-1/2">
              <div className="bg-white rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Order Details</h2>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-red-700 text-sm">{error}</div>
                  </div>
                )}

                <form onSubmit={handleSubmitOrder} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="cash">Cash on Delivery</option>
                      <option value="card">Credit/Debit Card</option>
                      <option value="paypal">PayPal</option>
                      <option value="bank">Bank Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Option
                    </label>
                    <div className="space-y-2">
                      {Object.entries(deliveryFees).map(([option, fee]) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="radio"
                            name="deliveryOption"
                            value={option}
                            checked={deliveryOption === option}
                            onChange={(e) => setDeliveryOption(e.target.value)}
                            className="mr-2"
                          />
                          <span className="capitalize">{option}</span>
                          <span className="ml-auto text-sm text-gray-600">
                            {fee === 0 ? 'Free' : formatPrice(fee.toString())} • {estimatedDeliveryTimes[option]}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Address *
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Enter your full delivery address"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contact Information (Optional)
                    </label>
                    <input
                      type="tel"
                      value={contactInfo}
                      onChange={(e) => setContactInfo(e.target.value)}
                      placeholder="Phone number for delivery updates"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions (Optional)
                    </label>
                    <textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Any special delivery instructions or notes for the seller"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="enableTracking"
                      checked={enableTracking}
                      onChange={(e) => setEnableTracking(e.target.checked)}
                      className="mr-2"
                    />
                    <label htmlFor="enableTracking" className="text-sm text-gray-700">
                      Enable order tracking notifications
                    </label>
                  </div>

                  {/* Order Summary */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold text-gray-800">Order Summary</h3>
                      <button
                        type="button"
                        onClick={() => setShowPreview(!showPreview)}
                        className="text-sm text-teal-600 hover:text-teal-800 underline"
                      >
                        {showPreview ? 'Hide' : 'Show'} Preview
                      </button>
                    </div>

                    {showPreview && (
                      <div className="mb-4 p-3 bg-white rounded border text-sm">
                        <h4 className="font-medium mb-2">Order Confirmation Preview</h4>
                        <div className="space-y-1 text-xs">
                          <div><strong>Item:</strong> {listing.title}</div>
                          <div><strong>Seller:</strong> {seller.displayName}</div>
                          <div><strong>Payment:</strong> {paymentMethod.replace(/^\w/, c => c.toUpperCase())}</div>
                          <div><strong>Delivery:</strong> {deliveryOption.charAt(0).toUpperCase() + deliveryOption.slice(1)} ({estimatedDeliveryTimes[deliveryOption]})</div>
                          <div><strong>Address:</strong> {deliveryAddress || 'Not provided'}</div>
                          {contactInfo && <div><strong>Contact:</strong> {contactInfo}</div>}
                          {specialInstructions && <div><strong>Notes:</strong> {specialInstructions}</div>}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Price per item:</span>
                        <span>{formatPrice(listing.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Quantity:</span>
                        <span>{quantity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span>{formatPrice(subtotal.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Fee:</span>
                        <span>{formatPrice(deliveryFee.toString())}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tax (8%):</span>
                        <span>{formatPrice(tax.toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                        <span>Total:</span>
                        <span className="text-green-600">
                          {formatPrice(total.toFixed(2))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <span className="text-lg">🛒</span>
                        Place Order
                      </>
                    )}
                  </button>
                </form>
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
