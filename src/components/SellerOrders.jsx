import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';

// Error Boundary Component
class SellerOrdersErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('SellerOrders Error Boundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">⚠️ Something went wrong with the Orders page</div>
          <div className="text-gray-600 text-sm mb-4">
            Please refresh the page or contact support if the problem persists.
          </div>
          <details className="text-left bg-gray-100 p-4 rounded max-w-2xl mx-auto">
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              Technical Details (click to expand)
            </summary>
            <pre className="text-xs text-red-600 whitespace-pre-wrap">
              {this.state.error ? this.state.error.toString() : 'No error details available'}
              {this.state.errorInfo?.componentStack || 'No component stack available'}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mt-4"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const SellerOrders = ({ sellerId }) => {
  console.log('SellerOrders: Component starting to render');
  console.log('SellerOrders: sellerId prop:', sellerId);

  // Check if sellerId is provided
  if (!sellerId) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ Seller ID not provided</div>
        <div className="text-gray-600 text-sm">Please log in as a seller to view your orders.</div>
      </div>
    );
  }

  let formatPrice;
  try {
    const currencyContext = useCurrency();
    formatPrice = currencyContext.formatPrice;
    console.log('SellerOrders: Currency context loaded successfully');
  } catch (error) {
    console.error('SellerOrders: Currency context error:', error);
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">⚠️ Currency context not available</div>
        <div className="text-gray-600 text-sm">Please refresh the page and try again.</div>
      </div>
    );
  }

  const [orders, setOrders] = useState([]);
  const [buyers, setBuyers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, completed, cancelled

  console.log('SellerOrders: Component state initialized');

  useEffect(() => {
    if (!sellerId) return;

    const ordersQuery = query(
      collection(db, 'orders'),
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
        console.log(`SellerOrders: Found ${ordersData.length} orders for seller ${sellerId}`);
        setOrders(ordersData);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching orders:', error);
        setError('Failed to load orders. Please check your connection and try again.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sellerId]);

  // Fetch buyer information for all orders
  useEffect(() => {
    if (orders.length === 0) return;

    const uniqueBuyerIds = [...new Set(orders.map(order => order.buyerId).filter(Boolean))];

    const fetchBuyers = async () => {
      const buyersData = {};
      for (const buyerId of uniqueBuyerIds) {
        try {
          const buyerDoc = await getDoc(doc(db, 'users', buyerId));
          if (buyerDoc.exists()) {
            buyersData[buyerId] = buyerDoc.data();
          }
        } catch (error) {
          console.error(`Error fetching buyer ${buyerId}:`, error);
        }
      }
      setBuyers(buyersData);
    };

    fetchBuyers();
  }, [orders]);

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('Failed to update order status');
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

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

  const getStatusActions = (status) => {
    switch (status) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['delivered'];
      default:
        return [];
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
    <div className="w-full max-w-6xl mx-auto px-4">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">📦 My Orders</h2>
        <p className="text-gray-600">Manage orders for your products</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-3 mb-8">
        {[
          { key: 'all', label: 'All Orders', count: orders.length },
          { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'pending').length },
          { key: 'confirmed', label: 'Confirmed', count: orders.filter(o => o.status === 'confirmed').length },
          { key: 'preparing', label: 'Preparing', count: orders.filter(o => o.status === 'preparing').length },
          { key: 'ready', label: 'Ready', count: orders.filter(o => o.status === 'ready').length },
          { key: 'delivered', label: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
          { key: 'cancelled', label: 'Cancelled', count: orders.filter(o => o.status === 'cancelled').length }
        ].map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105 ${
              filter === key
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 hover:shadow-md'
            }`}
          >
            {label} <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
              filter === key ? 'bg-white/20' : 'bg-gray-100'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No orders found</h3>
          <p className="text-gray-500">
            {filter === 'all'
              ? "You haven't received any orders yet."
              : `No ${filter} orders found.`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
              {/* Order Header */}
              <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold">{order.title}</h3>
                    <p className="text-blue-100 text-sm mt-1">
                      Order #{order.id.slice(-8)} • {order.createdAt?.toDate?.()?.toLocaleDateString() || 'Date not available'}
                    </p>
                  </div>
                  <div className={`px-4 py-2 rounded-full text-xs font-semibold border-2 ${getStatusColor(order.status)} shadow-sm`}>
                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div className="p-8">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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

                  {/* Delivery Info */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">🚚 Delivery Information</h4>
                    <div className="space-y-2 text-sm">
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

                  {/* Buyer Information */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-3">👤 Buyer Information</h4>
                    <div className="space-y-2 text-sm">
                      {buyers[order.buyerId] ? (
                        <>
                          <div className="flex items-center gap-2">
                            {buyers[order.buyerId].photoURL ? (
                              <img
                                src={buyers[order.buyerId].photoURL}
                                alt={buyers[order.buyerId].displayName || 'Buyer'}
                                className="w-8 h-8 rounded-full border border-gray-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
                                <span className="text-xs text-white font-bold">
                                  {(buyers[order.buyerId].displayName || 'B').charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-gray-900">
                                {buyers[order.buyerId].displayName || 'Anonymous Buyer'}
                              </div>
                              {buyers[order.buyerId].email && (
                                <div className="text-gray-600 text-xs">
                                  {buyers[order.buyerId].email}
                                </div>
                              )}
                            </div>
                          </div>
                          {buyers[order.buyerId].phone && (
                            <div>
                              <span className="text-gray-600">Phone:</span>
                              <span className="font-medium text-gray-800 ml-1">{buyers[order.buyerId].phone}</span>
                            </div>
                          )}
                          {(() => {
                            console.log('Order delivery address:', order.deliveryAddress);
                            const hasDeliveryAddress = order.deliveryAddress && order.deliveryAddress.trim();
                            console.log('Has delivery address:', hasDeliveryAddress);
                            return hasDeliveryAddress ? (
                              <div className="mt-3">
                                <button
                                  onClick={() => {
                                    const address = order.deliveryAddress.trim();
                                    if (address) {
                                      // Try to open in Google Maps first, fallback to Apple Maps or generic maps
                                      const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
                                      const appleMapsUrl = `http://maps.apple.com/?daddr=${encodeURIComponent(address)}`;

                                      // Check if user is on iOS
                                      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

                                      if (isIOS) {
                                        window.open(appleMapsUrl, '_blank');
                                      } else {
                                        window.open(googleMapsUrl, '_blank');
                                      }
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
                                >
                                  <span className="text-base">🗺️</span>
                                  Navigate to Delivery Address
                                </button>
                              </div>
                            ) : (
                              <div className="mt-3 text-xs text-gray-500">
                                No delivery address available for navigation
                              </div>
                            );
                          })()}
                        </>
                      ) : (
                        <div className="text-gray-500 text-sm">
                          Buyer information loading...
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status Update Actions */}
                {getStatusActions(order.status).length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">Update Status</h4>
                    <div className="flex flex-wrap gap-2">
                      {getStatusActions(order.status).map((action) => (
                        <button
                          key={action}
                          onClick={() => updateOrderStatus(order.id, action)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            action === 'cancelled'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          }`}
                        >
                          Mark as {action.charAt(0).toUpperCase() + action.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Wrap SellerOrders with Error Boundary
const SellerOrdersWithErrorBoundary = (props) => (
  <SellerOrdersErrorBoundary>
    <SellerOrders {...props} />
  </SellerOrdersErrorBoundary>
);

export default SellerOrdersWithErrorBoundary;
