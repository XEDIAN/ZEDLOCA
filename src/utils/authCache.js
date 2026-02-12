export const cacheAuthState = (user) => {
  if (user) {
    localStorage.setItem('authUser', JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: Date.now()
    }));
  } else {
    localStorage.removeItem('authUser');
  }
};

export const getCachedAuthState = () => {
  const cached = localStorage.getItem('authUser');
  if (cached) {
    const user = JSON.parse(cached);
    // Expire cache after 24 hours
    if (Date.now() - user.lastLogin < 24 * 60 * 60 * 1000) {
      return user;
    } else {
      localStorage.removeItem('authUser');
    }
  }
  return null;
};
