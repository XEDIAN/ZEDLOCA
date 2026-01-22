import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { useCurrency } from './CurrencyContext';

const BuyerMyOrders = ({ buyerId, onBack }) => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [sellers, setSellers] = useState({});

  const { formatPrice } = useCurrency();

  useEffect(() => {
    if (!buyerId) return;

    // Query all orders for this buyer
    const ordersQuery = query(
      collection(db, 'orders'),
      where('buyerId', '==', buyerId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      ordersQuery,
      async (snapshot) => {
        const ordersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch seller information for each order
        const sellerIds = [...new Set(ordersData.map(order => order.sellerId))];
        const sellerPromises = sellerIds.map(async (sellerId) => {
          if (sellerId) {
            try {
              const sellerDoc = await getDoc(doc(db, 'users', sellerId));
              if (sellerDoc.exists()) {
                return { id: sellerId, ...sellerDoc.data() };
              }
            } catch (error) {
              console.error('Error fetching seller:', error);
            }
          }
          return null;
        });

        const sellerData = await Promise.all(sellerPromises);
        const sellersMap = {};
        sellerData.forEach(seller => {
          if (seller) sellersMap[seller.id] = seller;
        });

        setSellers(sellersMap);
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
  }, [buyerId]);

  // Filter and sort orders
  useEffect(() => {
    let filtered = orders;

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sellers[order.sellerId]?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0);
        case 'oldest':
          return (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0);
        case 'price-high':
          return (parseFloat(b.totalPrice || b.price * b.quantity || 0)) - (parseFloat(a.totalPrice || a.price * a.quantity || 0));
        case 'price-low':
          return (parseFloat(a.totalPrice || a.price * a.quantity || 0)) - (parseFloat(b.totalPrice || b.price * b.quantity || 0));
        default:
          return 0;
      }
    });

    setFilteredOrders(filtered);
  }, [orders, statusFilter, searchTerm, sortBy, sellers]);

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
        <span className="ml-3 text-gray-600">Loading your orders...</span>
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
    <div className="w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white rounded-lg mb-6">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">📦 My Orders</h1>
              <p className="text-blue-100 mt-1">View all your placed orders</p>
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

      {/* Order Statistics */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 Order Summary</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{orders.length}</div>
            <div className="text-sm text-gray-600">Total Orders</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {formatPrice(orders.reduce((sum, order) => sum + (parseFloat(order.totalPrice) || parseFloat(order.price) * order.quantity || 0), 0))}
            </div>
            <div className="text-sm text-gray-600">Total Spent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {orders.filter(order => order.status === 'delivered').length}
            </div>
            <div className="text-sm text-gray-600">Delivered</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {orders.filter(order => ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status)).length}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search orders by title, seller, or order ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Sort */}
          <div className="md:w-48">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
            </select>
          </div>
        </div>
      </div>

      <div className="px-4">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No orders found</h3>
            <p className="text-gray-500">
              {orders.length === 0
                ? "You haven't placed any orders yet. Start shopping to see your orders here!"
                : "Try adjusting your search or filter criteria."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300">
                {/* Order Header */}
                <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold">{order.title}</h3>
                      <p className="text-green-100 text-sm mt-1">
                        Order #{order.id.slice(-8)} • {order.createdAt?.toDate?.()?.toLocaleDateString() || 'Date not available'}
                      </p>
                      {sellers[order.sellerId] && (
                        <p className="text-green-100 text-sm mt-1">
                          Seller: {sellers[order.sellerId].displayName}
                        </p>
                      )}
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
                          <span className="font-semibold text-green-600">{formatPrice(order.totalPrice || (parseFloat(order.price?.replace(/[^0-9.-]+/g, '') || 0) * (order.quantity || 1)) || 0)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Seller Information */}
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-3">🏪 Seller Information</h4>
                      <div className="space-y-2 text-sm">
                        {sellers[order.sellerId] ? (
                          <>
                            <div>
                              <span className="text-gray-600">Name:</span>
                              <p className="font-medium text-gray-800 mt-1">{sellers[order.sellerId].displayName}</p>
                            </div>
                            {sellers[order.sellerId].email && (
                              <div>
                                <span className="text-gray-600">Email:</span>
                                <p className="font-medium text-gray-800 mt-1">{sellers[order.sellerId].email}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-500 italic">Seller information not available</p>
                        )}
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
                  </div>

                  {/* Order Actions */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                        onClick={() => {
                          // Implement reorder functionality
                          alert('Reorder functionality coming soon!');
                        }}
                      >
                        🔄 Reorder
                      </button>
                      <button
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                        onClick={() => {
                          // Implement contact seller functionality
                          alert('Contact seller functionality coming soon!');
                        }}
                      >
                        💬 Contact Seller
                      </button>
                      <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                        onClick={() => {
                          // Toggle detailed view
                          alert('Detailed view functionality coming soon!');
                        }}
                      >
                        📋 View Details
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerMyOrders;
