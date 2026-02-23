import React, { useState, useEffect } from 'react';
import crossDeviceTest from '../utils/crossDeviceTest';

const CrossDeviceTestPanel = () => {
  const [testSummary, setTestSummary] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    const updateSummary = () => {
      const summary = crossDeviceTest.getTestSummary();
      setTestSummary(summary);
      setTestResults(crossDeviceTest.testResults);
    };

    // Initial update
    updateSummary();

    // Update every 5 seconds
    const interval = setInterval(updateSummary, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleTestOffline = async () => {
    try {
      await crossDeviceTest.testOfflineScenario();
      alert('Offline test completed. Check console for results.');
    } catch (error) {
      alert('Offline test failed: ' + error.message);
    }
  };

  const handleTestVersionSync = async () => {
    try {
      await crossDeviceTest.testVersionSync();
      alert('Version sync test completed. Check console for results.');
    } catch (error) {
      alert('Version sync test failed: ' + error.message);
    }
  };

  const handleTestConflictResolution = async () => {
    try {
      await crossDeviceTest.testConflictResolution();
      alert('Conflict resolution test completed. Check console for results.');
    } catch (error) {
      alert('Conflict resolution test failed: ' + error.message);
    }
  };

  const handleExportResults = () => {
    const exportData = crossDeviceTest.exportResults();
    alert('Test results exported to JSON file.');
    console.log('Exported test data:', exportData);
  };

  if (!testSummary) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <div className="bg-white rounded-lg shadow-lg border p-4 max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${testSummary.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="font-semibold text-gray-900">Cross-Device Test</span>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? '▼' : '▲'}
          </button>
        </div>

        {/* Summary */}
        <div className="text-sm text-gray-600 mb-3">
          <div>Device: {testSummary.deviceId}</div>
          <div>Test ID: {testSummary.testId}</div>
          <div>Results: {testSummary.totalResults}</div>
          <div>Version: {testSummary.version}</div>
          <div>Status: {testSummary.isOnline ? 'Online' : 'Offline'}</div>
        </div>

        {/* Actions */}
        {isExpanded && (
          <div className="space-y-2 border-t pt-3">
            <button
              onClick={handleTestOffline}
              className="w-full bg-blue-500 text-white px-3 py-2 rounded text-sm hover:bg-blue-600 transition-colors"
            >
              Test Offline Scenario
            </button>
            <button
              onClick={handleTestVersionSync}
              className="w-full bg-green-500 text-white px-3 py-2 rounded text-sm hover:bg-green-600 transition-colors"
            >
              Test Version Sync
            </button>
            <button
              onClick={handleTestConflictResolution}
              className="w-full bg-yellow-500 text-white px-3 py-2 rounded text-sm hover:bg-yellow-600 transition-colors"
            >
              Test Conflict Resolution
            </button>
            <button
              onClick={handleExportResults}
              className="w-full bg-purple-500 text-white px-3 py-2 rounded text-sm hover:bg-purple-600 transition-colors"
            >
              Export Results
            </button>
          </div>
        )}

        {/* Results Preview */}
        {isExpanded && testResults.length > 0 && (
          <div className="mt-3 border-t pt-3 max-h-40 overflow-y-auto">
            <div className="text-xs text-gray-500 mb-2">Recent Results:</div>
            {testResults.slice(-5).map((result, index) => (
              <div key={index} className="text-xs text-gray-600 mb-1 p-1 bg-gray-50 rounded">
                <span className="font-mono">{new Date(result.timestamp).toLocaleTimeString()}</span>
                <span className="ml-2 text-blue-600">{result.type}</span>
                {result.error && <span className="ml-2 text-red-600">Error: {result.error}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossDeviceTestPanel;