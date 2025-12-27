import React from 'react';

/**
 * Usage: <RequireRole role="seller" userRole={role}> ... </RequireRole>
 * Only renders children if userRole matches role.
 */
function RequireRole({ role, userRole, children, fallback = null }) {
  if (userRole === role) return children;
  return fallback;
}

export default RequireRole;
