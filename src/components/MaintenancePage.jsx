import React, { useState, useEffect } from 'react';
import { FaTools, FaClock } from 'react-icons/fa';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const MaintenancePage = () => {
  const [message, setMessage] = useState('Site is under maintenance. Please check back later.');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load maintenance message from settings
    const loadMaintenanceMessage = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          if (settings.maintenance?.maintenanceMessage) {
            setMessage(settings.maintenance.maintenanceMessage);
          }
        }
      } catch (error) {
        console.error('Error loading maintenance message:', error);
      } finally {
        setLoading(false);
      }
    };

    loadMaintenanceMessage();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 text-center">
          <FaTools className="mx-auto text-4xl text-white mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">Under Maintenance</h1>
          <p className="text-orange-100">We'll be back soon!</p>
        </div>

        <div className="p-8 text-center">
          <div className="mb-6">
            <FaClock className="mx-auto text-6xl text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Scheduled Maintenance</h2>
            <p className="text-gray-600 leading-relaxed">
              {message}
            </p>
          </div>

          <div className="border-t pt-6">
            <p className="text-sm text-gray-500 mb-4">
              For urgent inquiries, please contact our support team.
            </p>
            <div className="flex items-center justify-center space-x-4 text-sm text-gray-600">
              <span>📧 support@zedloca.com</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={() => window.location.reload()}
              className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
