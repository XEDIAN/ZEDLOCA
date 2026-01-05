import React from 'react';
import { useCurrency } from './CurrencyContext';

const CurrencySelector = () => {
  const { selectedCurrency, setSelectedCurrency, availableCurrencies, currencySymbols } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="currency-select" className="text-sm font-medium text-gray-700">
        Currency:
      </label>
      <select
        id="currency-select"
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value)}
        className="px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
        aria-label="Select currency"
      >
        {availableCurrencies.map(currency => (
          <option key={currency} value={currency}>
            {currencySymbols[currency]} {currency}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CurrencySelector;
