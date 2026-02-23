import React, { useState, useEffect } from 'react';
import versionSync from '../utils/versionSync';

const VersionSyncIndicator = () => {
  const [status, setStatus] = useState('syncing');
  const [currentVersion, setCurrentVersion] = useState(versionSync.getCurrentVersion());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Listen for version sync events
    const handleVersionEvent = (event, data) => {
      switch (event) {
        case 'synced':
          setStatus('synced');
          setCurrentVersion(data);
          setTimeout(() => setStatus('idle'), 2000);
          break;
        case 'version_updated':
          setStatus('updated');
          setCurrentVersion(data.newVersion);
          setTimeout(() => setStatus('idle'), 3000);
          break;
        case 'sync_failed':
          setStatus('error');
          setTimeout(() => setStatus('idle'), 3000);
          break;
      }
    };

    // Listen for network changes
    const handleOnline = () => {
      setIsOnline(true);
      setStatus('syncing');
      versionSync.syncVersion();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStatus('offline');
    };

    versionSync.addListener(handleVersionEvent);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      versionSync.removeListener(handleVersionEvent);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'syncing':
        return {
          icon: '🔄',
          text: 'Syncing...',
          color: 'bg-blue-500',
          pulse: true
        };
      case 'synced':
        return {
          icon: '✅',
          text: 'Synced',
          color: 'bg-green-500',
          pulse: false
        };
      case 'updated':
        return {
          icon: '🆕',
          text: 'Version Updated',
          color: 'bg-yellow-500',
          pulse: false
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Sync Failed',
          color: 'bg-red-500',
          pulse: false
        };
      case 'offline':
        return {
          icon: '📵',
          text: 'Offline',
          color: 'bg-gray-500',
          pulse: false
        };
      default:
        return {
          icon: '⚡',
          text: 'Ready',
          color: 'bg-gray-400',
          pulse: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="fixed top-20 right-4 z-50">
      <div className={`flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg border ${config.pulse ? 'animate-pulse' : ''}`}>
        <div className={`w-3 h-3 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}></div>
        <span className="text-sm font-medium text-gray-700">{config.icon} {config.text}</span>
        <span className="text-xs text-gray-500 ml-2">v{currentVersion}</span>
      </div>
    </div>
  );
};

export default VersionSyncIndicator;