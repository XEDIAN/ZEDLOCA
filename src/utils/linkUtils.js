export const getBaseUrl = () => {
  // In development, always use the ngrok URL for sharing links
  if (process.env.NODE_ENV === 'development') {
    // Use the current ngrok tunnel if we're running on it
    if (window.location.hostname.includes('ngrok')) {
      return window.location.origin;
    }
    // Otherwise, try to get the ngrok URL from localStorage or use a default
    const storedNgrokUrl = localStorage.getItem('ngrokUrl');
    if (storedNgrokUrl) {
      return storedNgrokUrl;
    }
    // Default fallback - user should set this to their active ngrok URL
    return 'https://unmethodizing-precongressional-hudson.ngrok-free.dev';
  }
  // In production, use the current origin
  return window.location.origin;
};

// Function to set the current ngrok URL
export const setNgrokUrl = (url) => {
  if (url && url.includes('ngrok')) {
    localStorage.setItem('ngrokUrl', url);
  }
};

export const getSellerProfileUrl = (sellerId) => {
  return `${getBaseUrl()}/seller/${sellerId}`;
};
