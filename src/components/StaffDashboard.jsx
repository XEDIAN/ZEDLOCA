import React, { useState, useEffect } from 'react';
import { FaUserShield, FaUsers, FaStore, FaShoppingCart, FaChartLine, FaCog, FaSignOutAlt, FaEye, FaTrash, FaBan, FaTimes, FaSearch, FaFilter, FaDownload, FaCalendar, FaSync, FaCheckSquare, FaSquare, FaChevronLeft, FaChevronRight, FaMap } from 'react-icons/fa';
import { auth, db } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, limit, startAfter, getCountFromServer, onSnapshot } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { isStaffSessionValid, refreshStaffSession, clearStaffSession, getRemainingSessionTime, isSessionExpiringSoon } from '../utils/staffAuth';

const StaffDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Search and Filter states
  const [userSearch, setUserSearch] = useState('');
  const [sellerSearch, setSellerSearch] = useState('');
  const [listingSearch, setListingSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [listingCategoryFilter, setListingCategoryFilter] = useState('all');
  const [dateRange, setDateRange] = useState({ start: null, end: null });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Bulk actions states
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedListings, setSelectedListings] = useState([]);

  // Analytics data
  const [analyticsData, setAnalyticsData] = useState({
    userGrowth: [],
    listingTrends: [],
    categoryDistribution: []
  });

  // Activity logs
  const [activityLogs, setActivityLogs] = useState([]);

  // Real-time updates
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Geographic heatmap states
  const [heatmapType, setHeatmapType] = useState('users');
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC
  const [mapZoom, setMapZoom] = useState(10);

  // Settings state
  const [settings, setSettings] = useState({
    platform: {
      maxListingsPerUser: 50,
      commissionRate: 0
    },
    security: {
      passwordMinLength: 8,
      sessionTimeout: 30,
      requireTwoFactor: false,
      maxLoginAttempts: 5
    },
    notifications: {
      emailNewUser: true,
      emailNewListing: true,
      emailSuspension: true,
      smsNotifications: false
    },
    maintenance: {
      maintenanceMode: false,
      maintenanceMessage: 'Site is under maintenance. Please check back later.'
    },
    registration: {
      autoApproveSellers: false,
      requireEmailVerification: true,
      requirePhoneVerification: false,
      allowGuestPosting: false
    }
  });
  const [settingsTab, setSettingsTab] = useState('platform');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    // Check authentication
    const isAuthenticated = localStorage.getItem('staffAuthenticated');
    if (!isAuthenticated) {
      window.location.href = '/staff-login';
      return;
    }

    // Set up real-time listeners
    const usersUnsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      generateAnalyticsData(usersData, sellers, listings);
      generateActivityLogs(usersData, sellers, listings);
      setLastRefresh(new Date());
    });

    const sellersUnsubscribe = onSnapshot(collection(db, 'sellers'), (snapshot) => {
      const sellersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSellers(sellersData);
      generateAnalyticsData(users, sellersData, listings);
      generateActivityLogs(users, sellersData, listings);
    });

    const listingsUnsubscribe = onSnapshot(collection(db, 'listings'), (snapshot) => {
      const listingsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setListings(listingsData);
      generateAnalyticsData(users, sellers, listingsData);
      generateActivityLogs(users, sellers, listingsData);
    });

    setLoading(false);

    // Set up auto-refresh if enabled (for analytics updates)
    let interval;
    if (autoRefresh) {
      interval = setInterval(() => {
        setLastRefresh(new Date());
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      usersUnsubscribe();
      sellersUnsubscribe();
      listingsUnsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

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

      // Generate analytics data
      generateAnalyticsData(usersData, sellersData, listingsData);

      // Generate activity logs
      generateActivityLogs(usersData, sellersData, listingsData);

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const generateAnalyticsData = (usersData, sellersData, listingsData) => {
    // User growth over last 7 days (mock data for demo)
    const userGrowth = Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(new Date(), 6 - i), 'MMM dd'),
      users: Math.floor(Math.random() * 50) + usersData.length - 25
    }));

    // Listing trends over last 7 days
    const listingTrends = Array.from({ length: 7 }, (_, i) => ({
      date: format(subDays(new Date(), 6 - i), 'MMM dd'),
      listings: Math.floor(Math.random() * 30) + listingsData.length - 15
    }));

    // Category distribution
    const categories = {};
    listingsData.forEach(listing => {
      categories[listing.category] = (categories[listing.category] || 0) + 1;
    });

    const categoryDistribution = Object.entries(categories).map(([name, value]) => ({
      name,
      value
    }));

    setAnalyticsData({ userGrowth, listingTrends, categoryDistribution });
  };

  const generateActivityLogs = (usersData, sellersData, listingsData) => {
    const logs = [
      ...usersData.slice(0, 5).map(user => ({
        id: `user-${user.id}`,
        type: 'user_registration',
        message: `New user ${user.displayName} registered`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7)
      })),
      ...sellersData.slice(0, 3).map(seller => ({
        id: `seller-${seller.id}`,
        type: 'seller_registration',
        message: `New seller ${seller.displayName} joined`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7)
      })),
      ...listingsData.slice(0, 5).map(listing => ({
        id: `listing-${listing.id}`,
        type: 'listing_created',
        message: `New listing "${listing.title}" created`,
        timestamp: new Date(Date.now() - Math.random() * 86400000 * 7)
      }))
    ].sort((a, b) => b.timestamp - a.timestamp);

    setActivityLogs(logs);
  };

  const handleLogout = () => {
    localStorage.removeItem('staffAuthenticated');
    window.location.href = '/';
  };

  const suspendUser = async (userId) => {
    try {
      await updateDoc(doc(db, 'users', userId), { suspended: true });
      loadData();
    } catch (error) {
      console.error('Error suspending user:', error);
    }
  };

  const deleteListing = async (listingId) => {
    try {
      await deleteDoc(doc(db, 'listings', listingId));
      loadData();
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
  };

  const bulkSuspendUsers = async () => {
    try {
      const promises = selectedUsers.map(userId =>
        updateDoc(doc(db, 'users', userId), { suspended: true })
      );
      await Promise.all(promises);
      setSelectedUsers([]);
      loadData();
    } catch (error) {
      console.error('Error bulk suspending users:', error);
    }
  };

  const bulkDeleteListings = async () => {
    try {
      const promises = selectedListings.map(listingId =>
        deleteDoc(doc(db, 'listings', listingId))
      );
      await Promise.all(promises);
      setSelectedListings([]);
      loadData();
    } catch (error) {
      console.error('Error bulk deleting listings:', error);
    }
  };

  const exportData = (data, filename) => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + data.map(row => Object.values(row).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      // Validate settings
      if (settings.security.passwordMinLength < 6) {
        throw new Error('Password minimum length must be at least 6 characters');
      }
      if (settings.security.sessionTimeout < 5) {
        throw new Error('Session timeout must be at least 5 minutes');
      }
      if (settings.security.maxLoginAttempts < 1) {
        throw new Error('Max login attempts must be at least 1');
      }

      // Save to Firebase (using a settings collection)
      await updateDoc(doc(db, 'settings', 'global'), settings);

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
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

  // Filtered and paginated data
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
                         user.email?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'all' ||
                         (userStatusFilter === 'active' && !user.suspended) ||
                         (userStatusFilter === 'suspended' && user.suspended);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredSellers = sellers.filter(seller =>
    seller.displayName?.toLowerCase().includes(sellerSearch.toLowerCase()) ||
    seller.email?.toLowerCase().includes(sellerSearch.toLowerCase())
  );

  const filteredListings = listings.filter(listing => {
    const matchesSearch = listing.title?.toLowerCase().includes(listingSearch.toLowerCase()) ||
                         listing.sellerName?.toLowerCase().includes(listingSearch.toLowerCase());
    const matchesCategory = listingCategoryFilter === 'all' || listing.category === listingCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Pagination
  const paginate = (items, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    return items.slice(startIndex, startIndex + perPage);
  };

  const paginatedUsers = paginate(filteredUsers, currentPage, itemsPerPage);
  const paginatedSellers = paginate(filteredSellers, currentPage, itemsPerPage);
  const paginatedListings = paginate(filteredListings, currentPage, itemsPerPage);

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Colors for pie chart
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  // Get heatmap data based on type
  const getHeatmapData = () => {
    let data = [];
    if (heatmapType === 'users') {
      data = users
        .filter(user => user.location && user.location.lat && user.location.lng)
        .map(user => [user.location.lat, user.location.lng, 0.5]);
    } else if (heatmapType === 'sellers') {
      data = sellers
        .filter(seller => seller.lat && seller.lng)
        .map(seller => [seller.lat, seller.lng, 0.7]);
    } else if (heatmapType === 'listings') {
      // Group listings by seller location
      const locationCounts = {};
      listings.forEach(listing => {
        const seller = sellers.find(s => s.id === listing.sellerId);
        if (seller && seller.lat && seller.lng) {
          const key = `${seller.lat},${seller.lng}`;
          locationCounts[key] = (locationCounts[key] || 0) + 1;
        }
      });
      data = Object.entries(locationCounts).map(([coords, count]) => {
        const [lat, lng] = coords.split(',').map(Number);
        return [lat, lng, Math.min(count * 0.3, 1)]; // Scale intensity
      });
    }
    return data;
  };

  // Heatmap Layer Component
  const HeatmapLayer = ({ data, type }) => {
    const map = useMap();

    useEffect(() => {
      if (!data || data.length === 0) return;

      // Remove existing heatmap
      map.eachLayer((layer) => {
        if (layer instanceof L.HeatLayer) {
          map.removeLayer(layer);
        }
      });

      // Add new heatmap
      const heatLayer = L.heatLayer(data, {
        radius: 25,
        blur: 15,
        maxZoom: 10,
        max: 1.0,
        gradient: {
          0.2: 'green',
          0.4: 'yellow',
          0.6: 'orange',
          0.8: 'red',
          1.0: 'darkred'
        }
      });

      heatLayer.addTo(map);

      return () => {
        if (map.hasLayer(heatLayer)) {
          map.removeLayer(heatLayer);
        }
      };
    }, [data, map]);

    return null;
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
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Dashboard Overview</h2>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => setAutoRefresh(!autoRefresh)}
                          className={`inline-flex items-center px-3 py-2 border rounded-md text-sm font-medium ${
                            autoRefresh
                              ? 'bg-green-100 text-green-700 border-green-300'
                              : 'bg-gray-100 text-gray-700 border-gray-300'
                          }`}
                        >
                          <FaSync className={`mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                          Auto Refresh {autoRefresh ? 'On' : 'Off'}
                        </button>
                        <span className="text-sm text-gray-500">
                          Last updated: {format(lastRefresh, 'HH:mm:ss')}
                        </span>
                      </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                      <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 7 Days)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={analyticsData.userGrowth}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="users" stroke="#8884d8" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white p-6 rounded-lg border">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Listing Trends (Last 7 Days)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={analyticsData.listingTrends}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="listings" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Category Distribution */}
                    <div className="bg-white p-6 rounded-lg border mb-8">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={analyticsData.categoryDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {analyticsData.categoryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Geographic Analytics */}
                    <div className="bg-white p-6 rounded-lg border mb-8">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Geographic Analytics</h3>
                        <div className="flex items-center space-x-2">
                          <select
                            value={heatmapType}
                            onChange={(e) => setHeatmapType(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="users">User Density</option>
                            <option value="sellers">Seller Density</option>
                            <option value="listings">Listing Activity</option>
                          </select>
                        </div>
                      </div>
                      <div className="h-96 rounded-lg overflow-hidden border">
                        <MapContainer
                          center={mapCenter}
                          zoom={mapZoom}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <HeatmapLayer
                            data={getHeatmapData()}
                            type={heatmapType}
                          />
                        </MapContainer>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
                        <div className="flex items-center space-x-4">
                          <span>Showing: {heatmapType === 'users' ? users.length : heatmapType === 'sellers' ? sellers.length : listings.length} locations</span>
                          <span>•</span>
                          <span>Heat intensity indicates density</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-xs">High</span>
                          <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                          <span className="text-xs">Medium</span>
                          <div className="w-4 h-4 bg-green-400 rounded"></div>
                          <span className="text-xs">Low</span>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="bg-white p-6 rounded-lg border">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
                      <div className="space-y-3">
                        {activityLogs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <div className="flex items-center">
                              <div className={`w-2 h-2 rounded-full mr-3 ${
                                log.type === 'user_registration' ? 'bg-blue-500' :
                                log.type === 'seller_registration' ? 'bg-green-500' : 'bg-purple-500'
                              }`}></div>
                              <span className="text-sm text-gray-900">{log.message}</span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {format(log.timestamp, 'MMM dd, HH:mm')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => exportData(filteredUsers.map(u => ({
                            Name: u.displayName,
                            Email: u.email,
                            Role: u.role || 'buyer',
                            Location: u.location && u.location.lat && u.location.lng ? `${u.location.lat.toFixed(2)}, ${u.location.lng.toFixed(2)}` : 'Not set',
                            'Last Location Update': u.location?.updatedAt ? format(u.location.updatedAt.toDate(), 'MMM dd, yyyy HH:mm:ss') : 'Never',
                            Status: u.suspended ? 'Suspended' : 'Active'
                          })), 'users.csv')}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <FaDownload className="mr-2" />
                          Export CSV
                        </button>
                        {selectedUsers.length > 0 && (
                          <button
                            onClick={bulkSuspendUsers}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                          >
                            <FaBan className="mr-2" />
                            Suspend Selected ({selectedUsers.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-3 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search users..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <select
                          value={userRoleFilter}
                          onChange={(e) => setUserRoleFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">All Roles</option>
                          <option value="buyer">Buyers</option>
                          <option value="seller">Sellers</option>
                        </select>
                        <select
                          value={userStatusFilter}
                          onChange={(e) => setUserStatusFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">All Status</option>
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600 mr-2">Total: {filteredUsers.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <input
                                type="checkbox"
                                checked={selectedUsers.length === paginatedUsers.length && paginatedUsers.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedUsers(paginatedUsers.map(u => u.id));
                                  } else {
                                    setSelectedUsers([]);
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Accuracy</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Location Update</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedUsers.map((user) => (
                            <tr key={user.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedUsers.includes(user.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedUsers([...selectedUsers, user.id]);
                                    } else {
                                      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
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
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {user.location && user.location.lat && user.location.lng
                                  ? `${user.location.lat.toFixed(2)}, ${user.location.lng.toFixed(2)}`
                                  : 'Not set'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.location && user.location.accuracy
                                  ? `${user.location.accuracy.toFixed(0)}m`
                                  : 'N/A'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user.location?.updatedAt
                                  ? format(user.location.updatedAt.toDate(), 'MMM dd, HH:mm')
                                  : 'Never'}
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

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length} results
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FaChevronLeft className="mr-1" />
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {currentPage} of {Math.ceil(filteredUsers.length / itemsPerPage)}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(Math.ceil(filteredUsers.length / itemsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(filteredUsers.length / itemsPerPage)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                          <FaChevronRight className="ml-1" />
                        </button>
                      </div>
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
                                <button onClick={() => viewSeller(seller)} className="text-blue-600 hover:text-blue-900 mr-4">
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
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-semibold text-gray-900">Listing Management</h2>
                      <div className="flex items-center space-x-4">
                        <button
                          onClick={() => exportData(filteredListings.map(l => ({
                            Title: l.title,
                            Description: l.description,
                            Category: l.category,
                            Price: l.price,
                            Seller: l.sellerName || 'Unknown'
                          })), 'listings.csv')}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <FaDownload className="mr-2" />
                          Export CSV
                        </button>
                        {selectedListings.length > 0 && (
                          <button
                            onClick={bulkDeleteListings}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                          >
                            <FaTrash className="mr-2" />
                            Delete Selected ({selectedListings.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="bg-gray-50 p-4 rounded-lg mb-6">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative">
                          <FaSearch className="absolute left-3 top-3 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search listings..."
                            value={listingSearch}
                            onChange={(e) => setListingSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <select
                          value={listingCategoryFilter}
                          onChange={(e) => setListingCategoryFilter(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="all">All Categories</option>
                          {Array.from(new Set(listings.map(l => l.category))).map(category => (
                            <option key={category} value={category}>{category}</option>
                          ))}
                        </select>
                        <div className="flex items-center">
                          <span className="text-sm text-gray-600 mr-2">Total: {filteredListings.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              <input
                                type="checkbox"
                                checked={selectedListings.length === paginatedListings.length && paginatedListings.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedListings(paginatedListings.map(l => l.id));
                                  } else {
                                    setSelectedListings([]);
                                  }
                                }}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seller</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {paginatedListings.map((listing) => (
                            <tr key={listing.id}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedListings.includes(listing.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedListings([...selectedListings, listing.id]);
                                    } else {
                                      setSelectedListings(selectedListings.filter(id => id !== listing.id));
                                    }
                                  }}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
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

                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-6">
                      <div className="text-sm text-gray-700">
                        Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredListings.length)} of {filteredListings.length} results
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FaChevronLeft className="mr-1" />
                          Previous
                        </button>
                        <span className="text-sm text-gray-700">
                          Page {currentPage} of {Math.ceil(filteredListings.length / itemsPerPage)}
                        </span>
                        <button
                          onClick={() => setCurrentPage(Math.min(Math.ceil(filteredListings.length / itemsPerPage), currentPage + 1))}
                          disabled={currentPage === Math.ceil(filteredListings.length / itemsPerPage)}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-500 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Next
                          <FaChevronRight className="ml-1" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">Activity Logs</h2>
                    <div className="space-y-4">
                      {activityLogs.map((log) => (
                        <div key={log.id} className="bg-white p-4 rounded-lg border">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full mr-3 ${
                                log.type === 'user_registration' ? 'bg-blue-500' :
                                log.type === 'seller_registration' ? 'bg-green-500' : 'bg-purple-500'
                              }`}></div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{log.message}</p>
                                <p className="text-xs text-gray-500">
                                  {format(log.timestamp, 'MMM dd, yyyy HH:mm:ss')}
                                </p>
                              </div>
                            </div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              log.type === 'user_registration' ? 'bg-blue-100 text-blue-800' :
                              log.type === 'seller_registration' ? 'bg-green-100 text-green-800' :
                              'bg-purple-100 text-purple-800'
                            }`}>
                              {log.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-6">System Settings</h2>

                    {/* Tab Navigation */}
                    <div className="border-b border-gray-200 mb-6">
                      <nav className="-mb-px flex space-x-8">
                        {['platform', 'security', 'notifications', 'maintenance', 'registration'].map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setSettingsTab(tab)}
                            className={`py-2 px-1 border-b-2 font-medium text-sm ${
                              settingsTab === tab
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)} Settings
                          </button>
                        ))}
                      </nav>
                    </div>

                    {/* Settings Content */}
                    <div className="space-y-6">
                      {settingsTab === 'platform' && (
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Configuration</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Listings per User
                              </label>
                              <input
                                type="number"
                                value={settings.platform.maxListingsPerUser}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  platform: { ...settings.platform, maxListingsPerUser: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Commission Rate (%)
                              </label>
                              <input
                                type="number"
                                value={settings.platform.commissionRate}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  platform: { ...settings.platform, commissionRate: parseInt(e.target.value) || 0 }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'security' && (
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Security Settings</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Minimum Password Length
                              </label>
                              <input
                                type="number"
                                value={settings.security.passwordMinLength}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  security: { ...settings.security, passwordMinLength: parseInt(e.target.value) || 6 }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Session Timeout (minutes)
                              </label>
                              <input
                                type="number"
                                value={settings.security.sessionTimeout}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  security: { ...settings.security, sessionTimeout: parseInt(e.target.value) || 5 }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Max Login Attempts
                              </label>
                              <input
                                type="number"
                                value={settings.security.maxLoginAttempts}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  security: { ...settings.security, maxLoginAttempts: parseInt(e.target.value) || 1 }
                                })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.security.requireTwoFactor}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  security: { ...settings.security, requireTwoFactor: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Require Two-Factor Authentication
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'notifications' && (
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h3>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.notifications.emailNewUser}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  notifications: { ...settings.notifications, emailNewUser: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Email notifications for new user registrations
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.notifications.emailNewListing}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  notifications: { ...settings.notifications, emailNewListing: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Email notifications for new listings
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.notifications.emailSuspension}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  notifications: { ...settings.notifications, emailSuspension: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Email notifications for user suspensions
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.notifications.smsNotifications}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  notifications: { ...settings.notifications, smsNotifications: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Enable SMS notifications
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'maintenance' && (
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">Maintenance Mode</h3>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.maintenance.maintenanceMode}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  maintenance: { ...settings.maintenance, maintenanceMode: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Enable maintenance mode
                              </label>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Maintenance Message
                              </label>
                              <textarea
                                value={settings.maintenance.maintenanceMessage}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  maintenance: { ...settings.maintenance, maintenanceMessage: e.target.value }
                                })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter maintenance message..."
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {settingsTab === 'registration' && (
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 mb-4">User Registration Settings</h3>
                          <div className="space-y-4">
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.registration.autoApproveSellers}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  registration: { ...settings.registration, autoApproveSellers: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Auto-approve seller registrations
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.registration.requireEmailVerification}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  registration: { ...settings.registration, requireEmailVerification: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Require email verification for new accounts
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.registration.requirePhoneVerification}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  registration: { ...settings.registration, requirePhoneVerification: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Require phone verification for new accounts
                              </label>
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                checked={settings.registration.allowGuestPosting}
                                onChange={(e) => setSettings({
                                  ...settings,
                                  registration: { ...settings.registration, allowGuestPosting: e.target.checked }
                                })}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label className="ml-2 block text-sm text-gray-900">
                                Allow guest posting without registration
                              </label>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Save Button and Messages */}
                      <div className="flex justify-between items-center pt-6 border-t">
                        {saveMessage && (
                          <div className={`text-sm ${saveMessage.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>
                            {saveMessage}
                          </div>
                        )}
                        <div className="ml-auto">
                          <button
                            onClick={saveSettings}
                            disabled={saving}
                            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? 'Saving...' : 'Save Settings'}
                          </button>
                        </div>
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
