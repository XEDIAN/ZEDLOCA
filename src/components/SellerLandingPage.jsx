import React from 'react';
import { FaMapMarkerAlt, FaList, FaInbox, FaShoppingCart, FaUser, FaUsers, FaStore } from 'react-icons/fa';
import DraggableSidebar from './DraggableSidebar';

const SellerLandingPage = ({
  onNavigateToMap,
  onNavigateToListings,
  onNavigateToInbox,
  onNavigateToOrders,
  onNavigateToProfile,
  onNavigateToBuyers,
  onNavigateToStores,
  role
}) => {
  const actions = [
    { label: 'Map', icon: FaMapMarkerAlt, onClick: onNavigateToMap, color: 'bg-blue-500 hover:bg-blue-600' },
    { label: 'Listings', icon: FaList, onClick: onNavigateToListings, color: 'bg-green-500 hover:bg-green-600' },
    { label: 'Inbox', icon: FaInbox, onClick: onNavigateToInbox, color: 'bg-yellow-500 hover:bg-yellow-600' },
    { label: 'Orders', icon: FaShoppingCart, onClick: onNavigateToOrders, color: 'bg-purple-500 hover:bg-purple-600' },
    { label: 'Profile', icon: FaUser, onClick: onNavigateToProfile, color: 'bg-indigo-500 hover:bg-indigo-600' },
    { label: 'Buyers', icon: FaUsers, onClick: onNavigateToBuyers, color: 'bg-red-500 hover:bg-red-600' },
    { label: 'Stores', icon: FaStore, onClick: onNavigateToStores, color: 'bg-teal-500 hover:bg-teal-600' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">Welcome to Your Seller Dashboard</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`flex flex-col items-center justify-center p-12 rounded-lg shadow-lg text-white font-bold text-xl transition-transform transform hover:scale-105 ${action.color}`}
              >
                <action.icon className="text-6xl mb-6" />
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <DraggableSidebar role={role} onNavigateToInbox={onNavigateToInbox} onNavigateToMessages={() => {}} />
    </div>
  );
};

export default SellerLandingPage;
