import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';

/**
 * Props:
 * - open: boolean
 * - onClose: function
 * - listing: object
 * - seller: object
 * - buyer: object
 */
function PlaceOrderModal({ open, onClose, listing, seller, buyer }) {
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

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

  const handleClose = () => {
    setSuccess(false);
    setError('');
    setQuantity(1);
    setDeliveryAddress('');
    setSpecialInstructions('');
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleClose}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
                aria-label="Close modal"
              >
                <span className="text-xl">✕</span>
              </button>
              <div>
                <h2 className="text-xl font-bold">Place Order</h2>
                <p className="text-green-100">{listing.title}</p>
              </div>
            </div>
            {seller && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-300 text-sm">⭐</span>
                  ))}
                  <span className="text-xs text-green-100">(4.8)</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Listing Details */}
          <div className="bg-green-50 rounded-lg p-4 mb-4 border border-green-200">
            <h3 className="font-semibold text-gray-800 mb-2">{listing.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{listing.description}</p>
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold text-lg">{formatPrice(listing.price)}</span>
              <span className="text-gray-500">per item</span>
            </div>
            {listing.category && (
              <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
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
                  className="w-12 h-12 rounded-full border-2 border-green-400"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
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

          {success ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Order Placed Successfully!</h3>
              <p className="text-gray-600 mb-6">
                Your order has been sent to the seller. They will contact you soon to arrange delivery.
              </p>
              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitOrder}>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-red-700 text-sm">{error}</div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* Order Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-2">Order Summary</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Price per item:</span>
                      <span>{formatPrice(listing.price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Quantity:</span>
                      <span>{quantity}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg pt-2 border-t">
                      <span>Total:</span>
                      <span className="text-green-600">
                        {formatPrice((parseFloat(listing.price.replace(/[^0-9.-]+/g, '')) * quantity).toFixed(2))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaceOrderModal;
