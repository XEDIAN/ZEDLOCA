import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';
import { sendOrderNotificationToSeller } from '../utils/orderNotification';

/**
 * ReorderModal Component
 * 
 * Props:
 * - open: boolean - Controls modal visibility
 * - onClose: function - Callback to close modal
 * - originalOrder: object - The order being reordered
 * - buyer: object - Current buyer information
 */
function ReorderModal({ open, onClose, originalOrder, buyer }) {
  const { formatPrice } = useCurrency();
  const [quantity, setQuantity] = useState(originalOrder.quantity || 1);
  const [deliveryAddress, setDeliveryAddress] = useState(originalOrder.deliveryAddress || '');
  const [specialInstructions, setSpecialInstructions] = useState(originalOrder.specialInstructions || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locationSuccess, setLocationSuccess] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [listing, setListing] = useState(null);
  const [seller, setSeller] = useState(null);

  // Load listing and seller information when modal opens
  useEffect(() => {
    if (open && originalOrder) {
      loadOrderDetails();
      // Auto-prompt for location when modal opens
      handleUpdateLocation();
    }
  }, [open, originalOrder]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setQuantity(originalOrder?.quantity || 1);
      setDeliveryAddress(originalOrder?.deliveryAddress || '');
      setSpecialInstructions(originalOrder?.specialInstructions || '');
      setLocation(null);
      setLocationError('');
      setLocationSuccess('');
      setSuccess(false);
      setError('');
      setLoading(false);
    }
  }, [open, originalOrder]);

  const loadOrderDetails = async () => {
    try {
      // Fetch listing details
      if (originalOrder.listingId) {
        const listingDoc = await getDoc(doc(db, 'listings', originalOrder.listingId));
        if (listingDoc.exists()) {
          setListing({ id: originalOrder.listingId, ...listingDoc.data() });
        }
      }

      // Fetch seller details
      if (originalOrder.sellerId) {
        const sellerDoc = await getDoc(doc(db, 'users', originalOrder.sellerId));
        if (sellerDoc.exists()) {
          setSeller({ id: originalOrder.sellerId, ...sellerDoc.data() });
        }
      }
    } catch (err) {
      console.error('Error loading order details:', err);
      setError('Failed to load order details. Please try again.');
    }
  };

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

  const handleUpdateLocation = async () => {
    setLocationLoading(true);
    setLocationError('');
    setLocationSuccess('');

    try {
      const currentLocation = await getLocation();

      // Check position accuracy and provide feedback
      if (currentLocation.accuracy <= 10) {
        // Position is very accurate
        setLocation(currentLocation);
        setLocationSuccess('Your position is very accurate!');

        // Update delivery address with current coordinates
        setDeliveryAddress(`GPS Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)} (Precise coordinates for accurate delivery)`);

        // Update buyer's stored location in Firestore for future orders
        if (buyer && buyer.uid) {
          try {
            const buyerRef = doc(db, 'users', buyer.uid);
            await updateDoc(buyerRef, {
              location: currentLocation,
              locationUpdatedAt: serverTimestamp()
            });
          } catch (firestoreError) {
            console.error('Error updating buyer location in Firestore:', firestoreError);
          }
        }
      } else if (currentLocation.accuracy <= 20) {
        // Position is accurate
        setLocation(currentLocation);
        setLocationSuccess('Your position is accurate!');

        // Update delivery address with current coordinates
        setDeliveryAddress(`GPS Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)} (Precise coordinates for accurate delivery)`);

        // Update buyer's stored location in Firestore for future orders
        if (buyer && buyer.uid) {
          try {
            const buyerRef = doc(db, 'users', buyer.uid);
            await updateDoc(buyerRef, {
              location: currentLocation,
              locationUpdatedAt: serverTimestamp()
            });
          } catch (firestoreError) {
            console.error('Error updating buyer location in Firestore:', firestoreError);
          }
        }
      } else {
        // Position is not accurate enough
        setLocation(currentLocation);

        // Update delivery address with current coordinates (even if accuracy is poor)
        setDeliveryAddress(`GPS Location: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)} (Coordinates captured - accuracy: ${currentLocation.accuracy.toFixed(1)}m)`);

        // Update buyer's stored location in Firestore for future orders
        if (buyer && buyer.uid) {
          try {
            const buyerRef = doc(db, 'users', buyer.uid);
            await updateDoc(buyerRef, {
              location: currentLocation,
              locationUpdatedAt: serverTimestamp()
            });
          } catch (firestoreError) {
            console.error('Error updating buyer location in Firestore:', firestoreError);
          }
        }

        setLocationError(`Location accuracy is ${currentLocation.accuracy.toFixed(1)}m. Please move to an open area with better GPS signal and click "Refresh Location" to try again.`);
        setLocationLoading(false);
        return;
      }
    } catch (err) {
      console.error('Error updating location:', err);
      if (err.isGeolocationError) {
        setLocationError('Unable to access your location. Please check your browser permissions and try again.');
      } else {
        setLocationError('Failed to get your current location. Please try again.');
      }
    } finally {
      setLocationLoading(false);
    }
  };

  // Constants for calculations
  const taxRate = 0.08; // 8% tax
  const deliveryFee = 5.00; // Standard delivery fee
  const estimatedDeliveryTime = '3-5 business days';

  // Calculations
  const itemPrice = listing ? parseFloat(listing.price.replace(/[^0-9.-]+/g, '')) : parseFloat(originalOrder.price.replace(/[^0-9.-]+/g, ''));
  const subtotal = itemPrice * quantity;
  const tax = (subtotal + deliveryFee) * taxRate;
  const total = subtotal + deliveryFee + tax;

  const handleSubmitReorder = async (e) => {
    e.preventDefault();
    if (!deliveryAddress.trim()) {
      setError('Please provide a delivery address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Fetch seller profile from Firestore
      let sellerEmail = '';
      let sellerName = seller?.displayName || originalOrder.sellerName || '';
      let sellerProfile = {};
      try {
        const sellerDoc = await getDoc(doc(db, 'sellers', originalOrder.sellerId));
        if (sellerDoc.exists()) {
          const sellerData = sellerDoc.data();
          sellerEmail = sellerData.email || '';
          sellerName = sellerData.displayName || sellerData.name || sellerName;
          sellerProfile = {
            storeName: sellerData.storeName || '',
            displayName: sellerData.displayName || '',
            email: sellerData.email || '',
            phone: sellerData.phone || '',
            description: sellerData.description || '',
            address: sellerData.address || '',
            city: sellerData.city || '',
            state: sellerData.state || '',
            zipCode: sellerData.zipCode || '',
            website: sellerData.website || '',
            categories: sellerData.categories || [],
            paymentMethods: sellerData.paymentMethods || [],
            deliveryOptions: sellerData.deliveryOptions || [],
            location: sellerData.location || null,
            photoURL: sellerData.photoURL || '',
            coverPhotoURL: sellerData.coverPhotoURL || ''
          };
        }
      } catch (sellerError) {
        console.error('Error fetching seller profile:', sellerError);
      }

      // Fetch buyer profile from Firestore
      let buyerProfile = {};
      try {
        const buyerDoc = await getDoc(doc(db, 'buyers', buyer.uid));
        if (buyerDoc.exists()) {
          const buyerData = buyerDoc.data();
          buyerProfile = {
            occupation: buyerData.occupation || '',
            phone: buyerData.phone || '',
            bio: buyerData.bio || '',
            preferences: buyerData.preferences || {}
          };
        }
      } catch (buyerError) {
        console.error('Error fetching buyer profile:', buyerError);
      }

      const reorderData = {
        listingId: originalOrder.listingId,
        sellerId: originalOrder.sellerId,
        sellerName: sellerName,
        sellerEmail: sellerEmail,
        sellerProfile: sellerProfile,
        buyerId: buyer.uid,
        buyerName: buyer.displayName || '',
        buyerEmail: buyer.email || '',
        buyerProfile: buyerProfile,
        title: originalOrder.title,
        price: originalOrder.price,
        quantity: quantity,
        totalPrice: parseFloat(originalOrder.price.replace(/[^0-9.-]+/g, '')) * quantity,
        deliveryAddress: deliveryAddress.trim(),
        specialInstructions: specialInstructions.trim(),
        buyerLocation: location, // Current location for delivery coordination
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Reorder-specific fields
        isReorder: true,
        originalOrderId: originalOrder.id,
        reorderDate: serverTimestamp()
      };

      await addDoc(collection(db, 'orders'), reorderData);

      // Send notification to seller
      await sendOrderNotificationToSeller({
        sellerId: originalOrder.sellerId,
        sellerName: sellerName,
        buyer: {
          uid: buyer.uid,
          displayName: buyer.displayName,
          email: buyer.email
        },
        listing: {
          id: originalOrder.listingId,
          title: originalOrder.title,
          price: originalOrder.price
        },
        quantity: quantity,
        deliveryAddress: deliveryAddress.trim(),
        specialInstructions: specialInstructions.trim(),
        isReorder: true,
        originalOrderId: originalOrder.id
      });

      setSuccess(true);
    } catch (err) {
      console.error('Error placing reorder:', err);
      setError('Failed to place reorder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setError('');
    setLocationError('');
    setLocationSuccess('');
    setQuantity(originalOrder?.quantity || 1);
    setDeliveryAddress(originalOrder?.deliveryAddress || '');
    setSpecialInstructions(originalOrder?.specialInstructions || '');
    setLocation(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
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
                <h2 className="text-xl font-bold">🔄 Reorder Item</h2>
                <p className="text-green-100">Original order: #{originalOrder.id.slice(-8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-yellow-300 text-sm">⭐</span>
                ))}
                <span className="text-xs text-green-100">(4.8)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {success ? (
            <div className="text-center">
              <div className="text-4xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Reorder Placed Successfully!</h3>
              <p className="text-gray-600 mb-6">
                Your reorder has been sent to the seller. They will contact you soon to arrange delivery.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-800 mb-2">📋 Reorder Summary</h4>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Original Order:</span>
                    <span className="font-medium ml-2">#{originalOrder.id.slice(-8)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Reorder Date:</span>
                    <span className="font-medium ml-2">{new Date().toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Item:</span>
                    <span className="font-medium ml-2">{originalOrder.title}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-medium ml-2">{quantity}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Product Summary */}
              <div>
                <div className="bg-green-50 rounded-xl p-6 border border-green-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
                      <span className="text-white text-xl">📦</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Product Details</h3>
                      <p className="text-sm text-gray-600">Reordering from your previous purchase</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="border-b border-green-100 pb-4">
                      <h4 className="font-semibold text-gray-900 mb-2">{originalOrder.title}</h4>
                      <p className="text-gray-600 text-sm mb-3">
                        {listing?.description || 'Item from your previous order'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-green-600">{formatPrice(originalOrder.price)}</span>
                        <span className="text-sm text-gray-500">per item</span>
                      </div>
                      {listing?.category && (
                        <span className="inline-block bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full mt-2 font-medium">
                          {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                        </span>
                      )}
                    </div>

                    {/* Seller Info */}
                    <div className="bg-white rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        Seller Information
                      </h4>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {seller?.photoURL ? (
                            <img
                              src={seller.photoURL}
                              alt={seller.displayName}
                              className="w-10 h-10 rounded-full border-2 border-green-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                              <span className="text-sm text-white font-bold">
                                {seller?.displayName?.charAt(0)?.toUpperCase() || 'S'}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{seller?.displayName || originalOrder.sellerName || 'Seller'}</div>
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

              {/* Reorder Form */}
              <div>
                <div className="bg-white rounded-xl p-6 shadow-xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white text-xl">⚙️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Reorder Configuration</h3>
                      <p className="text-sm text-gray-600">Update details as needed</p>
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

                  <form onSubmit={handleSubmitReorder} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Delivery Address *
                      </label>
                      <textarea
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Enter your full delivery address including street, city, and postal code"
                        rows={4}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={handleUpdateLocation}
                        disabled={locationLoading}
                        className="mt-3 w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        {locationLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Getting Location...
                          </>
                        ) : (
                          <>
                            <span className="text-lg">📍</span>
                            Update Location
                          </>
                        )}
                      </button>

                      {locationSuccess && (
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">✅</span>
                            <div className="text-green-700 text-sm font-medium">{locationSuccess}</div>
                          </div>
                        </div>
                      )}

                      {locationError && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-500">📍</span>
                            <div className="text-orange-700 text-sm font-medium">{locationError}</div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Special Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        placeholder="Any special delivery notes or changes from your original order"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {/* Order Summary */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h4 className="font-semibold text-gray-800 mb-4">Reorder Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Price per item:</span>
                          <span className="font-medium">{formatPrice(originalOrder.price)}</span>
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
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="flex justify-between items-center">
                            <span className="text-lg font-bold text-gray-900">Total:</span>
                            <span className="text-2xl font-bold text-green-600">
                              {formatPrice(total.toFixed(2))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3">
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
                        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-lg font-bold transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center gap-3 text-lg"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                            Placing Reorder...
                          </>
                        ) : (
                          <>
                            <span className="text-xl">🔄</span>
                            Place Reorder - {formatPrice(total.toFixed(2))}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ReorderModal;