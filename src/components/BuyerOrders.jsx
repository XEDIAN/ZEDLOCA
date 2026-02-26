import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';
import MessageSellerModal from './MessageSellerModal';

const BuyerOrders = ({ buyerId, sellerId, onBack }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [buyer, setBuyer] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);

  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!buyerId || !sellerId) return;

    // Query orders for this specific buyer from this seller
    const ordersQuery = query(
      collection(db, 'orders'),
      where('buyerId', '==', buyerId),
      where('sellerId', '==', sellerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching buyer orders:', error);
        setError('Failed to load orders. Please check your connection and try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [buyerId, sellerId]);

  // Fetch buyer information
  useEffect(() => {
    if (!buyerId) return;

    const fetchBuyer = async () => {
      try {
        const buyerDoc = await getDoc(doc(db, 'users', buyerId));
        if (buyerDoc.exists()) {
          setBuyer(buyerDoc.data());
        }
      } catch (error) {
        console.error('Error fetching buyer info:', error);
      }
    };

    fetchBuyer();
  }, [buyerId]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading orders...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ {error}</div>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                📦 Orders from {buyer?.displayName || 'Buyer'}
              </h1>
              <p className="text-blue-100 mt-1">View all orders placed by this buyer</p>
            </div>
            <button
              onClick={onBack}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No orders found</h3>
            <p className="text-gray-500">
              This buyer hasn't placed any orders with you yet.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Order Header */}
                <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{order.title}</h3>
                      <p className="text-green-100 text-sm mt-1">
                        Order #{order.id.slice(-8)} • {order.createdAt?.toDate?.()?.toLocaleDateString() || 'Date not available'}
                      </p>
                    </div>
                    <div className={`px-4 py-2 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)} shadow-sm`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </div>
                  </div>
                </div>

                {/* Order Details */}
                <div className="p-6">
                  <div className="grid md:grid-cols-3 gap-6">
                    {/* Product & Pricing */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">📦 Order Details</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Price per item:</span>
                          <span className="font-medium">{formatPrice(order.price || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Quantity:</span>
                          <span className="font-medium">{order.quantity || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Price:</span>
                          <span className="font-semibold text-green-600">{formatPrice(order.totalPrice || (order.price * order.quantity) || 0)}</span>
                        </div>
                      </div>
                    </div>

{/* Buyer Profile Info */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">👤 Buyer Profile</h4>
                      <div className="space-y-2 text-sm">
                        {order.buyerProfile?.occupation && (
                          <div>
                            <span className="text-gray-600">Occupation:</span>
                            <p className="font-medium text-gray-800 mt-1">{order.buyerProfile.occupation}</p>
                          </div>
                        )}
                        {order.buyerProfile?.phone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <p className="font-medium text-gray-800 mt-1">{order.buyerProfile.phone}</p>
                          </div>
                        )}
                        {order.buyerProfile?.bio && (
                          <div>
                            <span className="text-gray-600">Bio:</span>
                            <p className="font-medium text-gray-800 mt-1">{order.buyerProfile.bio}</p>
                          </div>
                        )}
                        {!order.buyerProfile?.occupation && !order.buyerProfile?.phone && !order.buyerProfile?.bio && (
                          <p className="text-gray-500 italic">No profile information available</p>
                        )}
                      </div>
                      <button
                        onClick={() => setShowMessageModal(true)}
                        className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <span>💬</span>
                        Message Buyer
                      </button>
                    </div>

                    {/* Seller Profile Info */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">🏪 Seller Profile</h4>
                      <div className="space-y-2 text-sm">
                        {order.sellerProfile?.storeName && (
                          <div>
                            <span className="text-gray-600">Store:</span>
                            <p className="font-medium text-gray-800 mt-1">{order.sellerProfile.storeName}</p>
                          </div>
                        )}
                        {order.sellerProfile?.phone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <p className="font-medium text-gray-800 mt-1">{order.sellerProfile.phone}</p>
                          </div>
                        )}
                        {order.sellerProfile?.address && (
                          <div>
                            <span className="text-gray-600">Address:</span>
                            <p className="font-medium text-gray-800 mt-1">
                              {order.sellerProfile.address}
                              {order.sellerProfile.city && `, ${order.sellerProfile.city}`}
                              {order.sellerProfile.state && `, ${order.sellerProfile.state}`}
                              {order.sellerProfile.zipCode && ` ${order.sellerProfile.zipCode}`}
                            </p>
                          </div>
                        )}
                        {!order.sellerProfile?.storeName && !order.sellerProfile?.phone && !order.sellerProfile?.address && (
                          <p className="text-gray-500 italic">No profile information available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Delivery Info */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">🚚 Delivery Information</h4>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <span className="text-gray-600">Address:</span>
                        <p className="font-medium text-gray-800 mt-1">{order.deliveryAddress}</p>
                      </div>
                      {order.specialInstructions && (
                        <div>
                          <span className="text-gray-600">Special Instructions:</span>
                          <p className="font-medium text-gray-800 mt-1">{order.specialInstructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
)}
      </div>

      {/* Message Modal */}
      {showMessageModal && (
        <MessageSellerModal
          open={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          sellerId={sellerId}
          sellerName={auth.currentUser?.displayName || 'Seller'}
          buyerId={buyerId}
          prefillMessage={`Hi! Regarding Order #${orders[0]?.id?.slice(-8) || 'recent'}`}
        />
      )}
    </div>
  );
};

export default BuyerOrders;
