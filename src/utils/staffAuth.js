// Staff authentication session management
// This ensures the staff portal is only available during initial authentication

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Storage keys
const STAFF_AUTH_KEY = 'staffAuthenticated';
const STAFF_SESSION_KEY = 'staffSession';

/**
 * Initialize staff session on login
 * @param {string} email - The staff member's email
 */
export const initStaffSession = (email) => {
  const sessionData = {
    authenticated: true,
    email: email,
    loginTime: Date.now(),
    lastActivity: Date.now()
  };
  
  localStorage.setItem(STAFF_AUTH_KEY, 'true');
  localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(sessionData));
  
  return sessionData;
};

/**
 * Check if staff session is valid
 * @returns {boolean} - Whether the session is valid
 */
export const isStaffSessionValid = () => {
  const authFlag = localStorage.getItem(STAFF_AUTH_KEY);
  const sessionData = localStorage.getItem(STAFF_SESSION_KEY);
  
  // No authentication flag
  if (!authFlag || authFlag !== 'true') {
    return false;
  }
  
  // No session data
  if (!sessionData) {
    return false;
  }
  
  try {
    const session = JSON.parse(sessionData);
    
    // Check if session has expired (timeout)
    const now = Date.now();
    const timeSinceLastActivity = now - session.lastActivity;
    
    if (timeSinceLastActivity > SESSION_TIMEOUT) {
      // Session has expired, clear everything
      clearStaffSession();
      return false;
    }
    
    return session.authenticated === true;
  } catch (error) {
    console.error('Error parsing staff session:', error);
    clearStaffSession();
    return false;
  }
};

/**
 * Update last activity timestamp to refresh session
 */
export const refreshStaffSession = () => {
  const sessionData = localStorage.getItem(STAFF_SESSION_KEY);
  
  if (sessionData) {
    try {
      const session = JSON.parse(sessionData);
      session.lastActivity = Date.now();
      localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error refreshing staff session:', error);
    }
  }
};

/**
 * Clear staff session on logout
 */
export const clearStaffSession = () => {
  localStorage.removeItem(STAFF_AUTH_KEY);
  localStorage.removeItem(STAFF_SESSION_KEY);
};

/**
 * Get remaining session time in milliseconds
 * @returns {number|null} - Remaining time or null if no session
 */
export const getRemainingSessionTime = () => {
  const sessionData = localStorage.getItem(STAFF_SESSION_KEY);
  
  if (!sessionData) {
    return null;
  }
  
  try {
    const session = JSON.parse(sessionData);
    const elapsed = Date.now() - session.lastActivity;
    const remaining = SESSION_TIMEOUT - elapsed;
    
    return remaining > 0 ? remaining : 0;
  } catch (error) {
    return null;
  }
};

/**
 * Check if session is about to expire (less than 5 minutes remaining)
 * @returns {boolean}
 */
export const isSessionExpiringSoon = () => {
  const remaining = getRemainingSessionTime();
  return remaining !== null && remaining < 5 * 60 * 1000; // Less than 5 minutes
};

export default {
  initStaffSession,
  isStaffSessionValid,
  refreshStaffSession,
  clearStaffSession,
  getRemainingSessionTime,
  isSessionExpiringSoon
};
