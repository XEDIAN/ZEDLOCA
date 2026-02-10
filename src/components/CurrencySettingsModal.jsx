import React from 'react';
import { useCurrency } from './CurrencyContext';

const CurrencySettingsModal = ({ onClose }) => {
  const { selectedCurrency, setSelectedCurrency, availableCurrencies, currencySymbols } = useCurrency();

  const handleCurrencyChange = (currency) => {
    setSelectedCurrency(currency);
    onClose();
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
          <div className="flex items-center justify-between">
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
              aria-label="Close modal"
            >
              <span className="text-xl">✕</span>
            </button>
            <div>
              <h2 className="text-xl font-bold">Currency Settings</h2>
              <p className="text-blue-100 text-sm">Choose your preferred currency</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-3">
            {availableCurrencies.map((currency) => (
              <button
                key={currency}
                onClick={() => handleCurrencyChange(currency)}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  selectedCurrency === currency
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currencySymbols[currency]}</span>
                    <div className="text-left">
                      <p className="font-semibold">{currency}</p>
                      <p className="text-sm text-gray-500">
                        {currency === 'ZMW' && 'Zambian Kwacha'}
                        {currency === 'USD' && 'US Dollar'}
                        {currency === 'EUR' && 'Euro'}
                        {currency === 'GBP' && 'British Pound'}
                      </p>
                    </div>
                  </div>
                  {selectedCurrency === currency && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Note:</strong> Currency conversion rates are approximate and for display purposes only.
              Actual transaction amounts may vary based on current exchange rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurrencySettingsModal;
