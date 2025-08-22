import React from 'react';
import { auth } from '../firebase';
import Listings from './Listings';

function UserProfile() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  if (!user) {
    return (
      <div className="p-4 bg-white rounded shadow mt-8 text-center">
        <p>Please sign in to view your profile.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded shadow mt-8 max-w-md mx-auto">
      <div className="flex flex-col items-center">
        <img src={user.photoURL} alt="User" className="w-20 h-20 rounded-full mb-2" />
        <h2 className="text-xl font-bold mb-1">{user.displayName}</h2>
        <p className="mb-2 text-gray-600">{user.email}</p>
      </div>
      <Listings userId={user.uid} />
    </div>
  );
}

export default UserProfile;
