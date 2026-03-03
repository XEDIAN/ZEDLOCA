/**
 * LocationPerformanceMonitor - Monitors and displays hybrid positioning performance
 * Provides real-time metrics and accuracy validation for the positioning system
 */

import React, { useState, useEffect } from 'react';

const LocationPerformanceMonitor = ({ userId, hybridService }) => {
  const [performanceMetrics, setPerformanceMetrics] = useState(null);
  const [positioningHistory, setPositioningHistory] = useState([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState({
    lastUpdate: null,
    currentAccuracy: null,
    positioningMethod: 'unknown',
    batteryLevel: 100
  });

  useEffect(() => {
    if (!hybridService) return;

    const monitorPerformance = () => {
      try {
        // Get current hybrid status
        const status = hybridService.getHybridStatus();
        setPerformanceMetrics(status.performanceMetrics);

        // Get recent positioning history
        const history = status.positioningHistory || [];
        setPositioningHistory(history);

        // Calculate real-time metrics
        if (history.length > 0) {
          const latest = history[history.length - 1];
          setRealTimeMetrics({
            lastUpdate: latest.timestamp,
            currentAccuracy: latest.accuracy,
            positioningMethod: latest.method,
            batteryLevel: latest.batteryLevel || 100
          });
        }
      } catch (error) {
        console.warn('Performance monitoring error:', error);
      }
    };

    // Initial monitoring
    monitorPerformance();

    // Set up periodic monitoring
    const interval = setInterval(monitorPerformance, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [hybridService]);

  // Calculate performance statistics
  const calculateStats = () => {
    if (!performanceMetrics) return null;

    const { avgGnssAccuracy, avgCellularAccuracy, avgLatency, totalPositioningEvents } = performanceMetrics;

    return {
      avgGnssAccuracy: avgGnssAccuracy || 0,
      avgCellularAccuracy: avgCellularAccuracy || 0,
      avgLatency: avgLatency || 0,
      totalEvents: totalPositioningEvents || 0,
      successRate: calculateSuccessRate(),
      methodDistribution: calculateMethodDistribution()
    };
  };

  const calculateSuccessRate = () => {
    if (positioningHistory.length === 0) return 0;
    const successes = positioningHistory.filter(event => event.success).length;
    return (successes / positioningHistory.length) * 100;
  };

  const calculateMethodDistribution = () => {
    const distribution = {};
    positioningHistory.forEach(event => {
      const method = event.method || 'unknown';
      distribution[method] = (distribution[method] || 0) + 1;
    });
    return distribution;
  };

  const getAccuracyColor = (accuracy) => {
    if (accuracy <= 10) return 'text-green-600';
    if (accuracy <= 25) return 'text-blue-600';
    if (accuracy <= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getMethodColor = (method) => {
    switch (method) {
      case 'gnss_primary': return 'bg-green-100 text-green-700';
      case 'cellular_fallback': return 'bg-blue-100 text-blue-700';
      case 'cellular_primary': return 'bg-purple-100 text-purple-700';
      case 'gnss_degraded': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const stats = calculateStats();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">📊 Location Performance</h3>

      {/* Real-time Status */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h4 className="font-medium text-sm text-blue-800 mb-2">Current Status</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Method:</span>
              <span className={`px-2 py-1 rounded text-xs ${getMethodColor(realTimeMetrics.positioningMethod)}`}>
                {realTimeMetrics.positioningMethod.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Accuracy:</span>
              <span className={`font-medium ${getAccuracyColor(realTimeMetrics.currentAccuracy)}`}>
                {realTimeMetrics.currentAccuracy ? `${Math.round(realTimeMetrics.currentAccuracy)}m` : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Battery:</span>
              <span className="font-medium">{realTimeMetrics.batteryLevel}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Update:</span>
              <span className="font-medium text-xs">
                {realTimeMetrics.lastUpdate 
                  ? new Date(realTimeMetrics.lastUpdate).toLocaleTimeString()
                  : 'Unknown'
                }
              </span>
            </div>
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded p-4">
          <h4 className="font-medium text-sm text-green-800 mb-2">Performance Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Success Rate:</span>
              <span className="font-medium text-green-600">
                {stats ? `${stats.successRate.toFixed(1)}%` : 'Calculating...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Events:</span>
              <span className="font-medium">{stats ? stats.totalEvents : 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg GNSS Accuracy:</span>
              <span className={`font-medium ${getAccuracyColor(stats?.avgGnssAccuracy)}`}>
                {stats ? `${Math.round(stats.avgGnssAccuracy)}m` : 'Unknown'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Avg Cellular Accuracy:</span>
              <span className={`font-medium ${getAccuracyColor(stats?.avgCellularAccuracy)}`}>
                {stats ? `${Math.round(stats.avgCellularAccuracy)}m` : 'Unknown'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Method Distribution */}
      {stats && stats.methodDistribution && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-6">
          <h4 className="font-medium text-sm mb-3">Positioning Method Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stats.methodDistribution).map(([method, count]) => {
              const percentage = ((count / stats.totalEvents) * 100).toFixed(1);
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs ${getMethodColor(method)}`}>
                      {method.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">{count} ({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent History */}
      <div className="bg-white border border-gray-200 rounded p-4">
        <h4 className="font-medium text-sm mb-3">Recent Positioning Events</h4>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {positioningHistory.slice(-10).map((event, index) => (
            <div key={index} className="flex items-center justify-between text-xs border-b border-gray-100 pb-1">
              <div className="flex items-center space-x-2">
                <span className={`px-1 py-0.5 rounded ${getMethodColor(event.method)}`}>
                  {event.method.replace('_', ' ').toUpperCase()}
                </span>
                <span className={event.success ? 'text-green-600' : 'text-red-600'}>
                  {event.success ? '✓' : '✗'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={getAccuracyColor(event.accuracy)}>
                  {event.accuracy ? `${Math.round(event.accuracy)}m` : 'Unknown'}
                </span>
                <span className="text-gray-500">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded p-4">
        <h4 className="font-medium text-sm text-yellow-800 mb-2">Performance Recommendations</h4>
        <div className="text-xs text-yellow-700 space-y-1">
          {stats && stats.successRate < 80 && (
            <p>• Low success rate detected. Consider enabling hybrid positioning for better reliability.</p>
          )}
          {stats && stats.avgGnssAccuracy > 30 && (
            <p>• High GNSS accuracy errors. Try updating location in open areas with clear sky view.</p>
          )}
          {stats && stats.avgCellularAccuracy > 500 && (
            <p>• Poor cellular positioning accuracy. Ensure good network signal strength.</p>
          )}
          {stats && stats.avgLatency > 5000 && (
            <p>• High positioning latency detected. Check network connectivity and device performance.</p>
          )}
          <p>• For best results, keep location permissions enabled and maintain good network connectivity.</p>
          <p>• Hybrid positioning automatically switches between GNSS and cellular for optimal accuracy.</p>
        </div>
      </div>
    </div>
  );
};

export default LocationPerformanceMonitor;