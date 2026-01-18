import React, { createContext, useContext, useState, useEffect } from 'react';

// Currency exchange rates (ZMW as base currency)
// These are approximate rates - in production, you'd fetch from an API
const EXCHANGE_RATES = {
  ZMW: 1,
  USD: 0.055, // 1 ZMW ≈ 0.055 USD
  EUR: 0.050, // 1 ZMW ≈ 0.050 EUR
  GBP: 0.043, // 1 ZMW ≈ 0.043 GBP
};

const CURRENCY_SYMBOLS = {
  ZMW: 'K',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [selectedCurrency, setSelectedCurrency] = useState('ZMW');

  // Load saved currency preference from localStorage
  useEffect(() => {
    const savedCurrency = localStorage.getItem('selectedCurrency');
    if (savedCurrency && EXCHANGE_RATES[savedCurrency]) {
      setSelectedCurrency(savedCurrency);
    }
  }, []);

  // Save currency preference to localStorage
  useEffect(() => {
    localStorage.setItem('selectedCurrency', selectedCurrency);
  }, [selectedCurrency]);

  const convertPrice = (priceInZMW) => {
    // Parse the price string to extract numeric value
    const numericPrice = parseFloat(priceInZMW.toString().replace(/[^0-9.-]+/g, ''));
    if (isNaN(numericPrice)) return priceInZMW;

    const convertedAmount = numericPrice * EXCHANGE_RATES[selectedCurrency];
    return convertedAmount;
  };

  const formatPrice = (priceInZMW) => {
    const convertedAmount = convertPrice(priceInZMW);
    const symbol = CURRENCY_SYMBOLS[selectedCurrency];

    // Format with appropriate decimal places
    const formattedAmount = typeof convertedAmount === 'number'
      ? convertedAmount.toFixed(2)
      : convertedAmount;

    return `${symbol}${formattedAmount}`;
  };

  const value = {
    selectedCurrency,
    setSelectedCurrency,
    convertPrice,
    formatPrice,
    availableCurrencies: Object.keys(EXCHANGE_RATES),
    currencySymbols: CURRENCY_SYMBOLS,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
