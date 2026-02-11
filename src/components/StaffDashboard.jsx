import React, { useState, useEffect } from 'react';
import { FaUserShield, FaUsers, FaStore, FaShoppingCart, FaChartLine, FaCog, FaSignOutAlt, FaEye, FaTrash, FaBan, FaTimes } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';

const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('staffAuthenticated');
    if (!isAuthenticated) {
      window.location.href = '/staff-login';
      return;
    }

    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);

      // Load sellers
      const sellersSnapshot = await getDocs(collection(db, 'sellers'));
      const sellersData = sellersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(sellersData);

      // Load listings
      const listingsSnapshot = await getDocs(collection(db, 'listings'));
      const listingsData = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staffAuthenticated');
    window.location.href = '/';
  };

  const suspendUser = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), { suspended: true });
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const deleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      loadData(); // Refresh data
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  const viewSeller = (seller) => {
    setSelectedItem(seller);
    setViewModalOpen(true);
  };

  const viewListing = (listing) => {
    setSelectedItem(listing);
    setViewModalOpen(true);
  };

  const closeModal = () => {
    setViewModalOpen(false);
    setSelectedItem(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <FaUserShield className="text-blue-600 text-2xl mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">ZEDLOCA Staff Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FaSignOutAlt className="mr-2" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <div className="lg:w-64">
            <div className="bg-white rounded-lg shadow-sm border">
              <nav className="p-4">
                <ul className="space-y-2">
                  <li>
                    <button
                      onClick={() => setActiveTab('overview')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'overview'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaChartLine className="inline mr-2" />
                      Overview
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'users'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaUsers className="inline mr-2" />
                      Users
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('sellers')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'sellers'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaStore className="inline mr-2" />
                      Sellers
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('listings')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'listings'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaShoppingCart className="inline mr-2" />
                      Listings
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => setActiveTab('settings')}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium ${
                        activeTab === 'settings'
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <FaCog className="inline mr-2" />
                      Settings
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Dashboard Overview</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <FaUsers className="text-blue-600 text-2xl mr-3" />
                          <div>
                            <p className="text-sm font-medium text-blue-600">Total Users</p>
                            <p className="text-2xl font-bold text-blue-900">{users.length}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <FaStore className="text-green-600 text-2xl mr-3" />
                          <div>
                            <p className="text-sm font-medium text-green-600">Active Sellers</p>
                            <p className="text-2xl font-bold text-green-900">{sellers.length}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <FaShoppingCart className="text-purple-600 text-2xl mr-3" />
                          <div>
                            <p className="text-sm font-medium text-purple-600">Total Listings</p>
                            <p className="text-2xl font-bold text-purple-900">{listings.length}</p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="flex items-center">
                          <FaChartLine className="text-orange-600 text-2xl mr-3" />
                          <div>
                            <p className="text-sm font-medium text-orange-600">Platform Health</p>
                            <p className="text-2xl font-bold text-orange-900">Good</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">User Management</h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {users.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                      <span className="text-sm font-medium text-gray-700">
                                        {user.displayName?.charAt(0)?.toUpperCase() || 'U'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                                    <div className="text-sm text-gray-500">{user.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.role === 'seller' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {user.role || 'buyer'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  user.suspended ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                                }`}>
                                  {user.suspended ? 'Suspended' : 'Active'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => suspendUser(user.id)}
                                  className="text-red-600 hover:text-red-900 mr-4"
                                >
                                  <FaBan className="inline mr-1" />
                                  Suspend
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'sellers' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Seller Management</h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {sellers.map((seller) => (
                            <tr key={seller.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                                      <span className="text-sm font-medium text-gray-700">
                                        {seller.displayName?.charAt(0)?.toUpperCase() || 'S'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{seller.displayName}</div>
                                    <div className="text-sm text-gray-500">{seller.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {seller.lat && seller.lng ? `${seller.lat.toFixed(2)}, ${seller.lng.toFixed(2)}` : 'Not set'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  Active
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button className="text-blue-600 hover:text-blue-900 mr-4">
                                  <FaEye className="inline mr-1" />
                                  View
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'listings' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Listing Management</h2>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {listings.map((listing) => (
                            <tr key={listing.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10">
                                    <img className="h-10 w-10 rounded-lg object-cover" src={listing.images?.[0] || '/placeholder.jpg'} alt="" />
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-gray-900">{listing.title}</div>
                                    <div className="text-sm text-gray-500">{listing.category}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {listing.sellerName || 'Unknown'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                ${listing.price}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                  Active
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button
                                  onClick={() => viewListing(listing)}
                                  className="text-blue-600 hover:text-blue-900 mr-4"
                                >
                                  <FaEye className="inline mr-1" />
                                  View
                                </button>
                                <button
                                  onClick={() => deleteListing(listing.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <FaTrash className="inline mr-1" />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h2>
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Configuration</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Max Listings per User
                            </label>
                            <input
                              type="number"
                              defaultValue="50"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Commission Rate (%)
                            </label>
                            <input
                              type="number"
                              defaultValue="0"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                          Save Settings
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {viewModalOpen && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {selectedItem.title ? 'Listing Details' : 'Seller Details'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-xl" />
              </button>
            </div>
            <div className="space-y-4">
              {selectedItem.title ? (
                // Listing details
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <img
                        src={selectedItem.images?.[0] || '/placeholder.jpg'}
                        alt={selectedItem.title}
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-xl font-semibold">{selectedItem.title}</h4>
                      <p className="text-gray-600">{selectedItem.description}</p>
                      <p className="text-lg font-bold text-green-600">${selectedItem.price}</p>
                      <p className="text-sm text-gray-500">Category: {selectedItem.category}</p>
                      <p className="text-sm text-gray-500">Seller: {selectedItem.sellerName}</p>
                    </div>
                  </div>
                </>
              ) : (
                // Seller details
                <>
                  <div className="space-y-2">
                    <h4 className="text-xl font-semibold">{selectedItem.displayName}</h4>
                    <p className="text-gray-600">Email: {selectedItem.email}</p>
                    <p className="text-gray-600">Phone: {selectedItem.phone || 'Not provided'}</p>
                    <p className="text-gray-600">
                      Location: {selectedItem.lat && selectedItem.lng
                        ? `${selectedItem.lat.toFixed(2)}, ${selectedItem.lng.toFixed(2)}`
                        : 'Not set'}
                    </p>
                    <p className="text-gray-600">Business Type: {selectedItem.businessType || 'Not specified'}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
