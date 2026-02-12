const apiCache = new Map();

export const cachedFetch = async (url, options = {}) => {
  const cacheKey = `${options.method || 'GET'}-${url}`;

  // Return cached data if offline
  if (!navigator.onLine && apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    // Cache successful GET requests
    if (response.ok && (!options.method || options.method === 'GET')) {
      apiCache.set(cacheKey, data);
    }

    return data;
  } catch (error) {
    // Return cached data if available and request failed
    if (apiCache.has(cacheKey)) {
      return apiCache.get(cacheKey);
    }
    throw error;
  }
};
