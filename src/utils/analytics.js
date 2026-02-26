import { getAnalytics, logEvent } from '../firebase';

// Get analytics instance - ensures it's initialized
const getAnalyticsInstance = () => {
  try {
    return getAnalytics();
  } catch (error) {
    console.error('Error getting analytics instance:', error);
    return null;
  }
};

// Track custom events
export const trackEvent = (eventName, params = {}) => {
  const analytics = getAnalyticsInstance();
  if (analytics) {
    try {
      logEvent(analytics, eventName, params);
      console.log(`Analytics event tracked: ${eventName}`, params);
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  } else {
    console.log(`Analytics event (not sent - not initialized): ${eventName}`, params);
  }
};

// Pre-defined event trackers
export const trackPageView = (pageName, pagePath) => {
  trackEvent('page_view', {
    page_name: pageName,
    page_path: pagePath
  });
};

export const trackSellerView = (sellerId, sellerName) => {
  trackEvent('view_seller', {
    seller_id: sellerId,
    seller_name: sellerName
  });
};

export const trackMessageSent = (sellerId, messageType) => {
  trackEvent('message_sent', {
    seller_id: sellerId,
    message_type: messageType
  });
};

export const trackSaveSeller = (sellerId) => {
  trackEvent('save_seller', {
    seller_id: sellerId
  });
};

export const trackSearch = (searchTerm, resultsCount) => {
  trackEvent('search', {
    search_term: searchTerm,
    results_count: resultsCount
  });
};

export const trackButtonClick = (buttonName, buttonLocation) => {
  trackEvent('button_click', {
    button_name: buttonName,
    button_location: buttonLocation
  });
};

export const trackScreenView = (screenName, screenClass) => {
  const analytics = getAnalyticsInstance();
  if (analytics) {
    try {
      logEvent(analytics, 'screen_view', {
        screen_name: screenName,
        screen_class: screenClass
      });
      console.log(`Screen view tracked: ${screenName}`);
    } catch (error) {
      console.error('Error tracking screen view:', error);
    }
  }
};

export const trackAppOpen = () => {
  trackEvent('app_open');
};

export const trackUserLogin = (method) => {
  trackEvent('login', { method });
};

export const trackSignUp = (method) => {
  trackEvent('sign_up', { method });
};

export default {
  trackEvent,
  trackPageView,
  trackSellerView,
  trackMessageSent,
  trackSaveSeller,
  trackSearch,
  trackButtonClick,
  trackScreenView,
  trackAppOpen,
  trackUserLogin,
  trackSignUp
};
