import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';

function Auth() {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center mt-8">
      {user ? (
        <>
          <img src={user.photoURL} alt="User" className="w-16 h-16 rounded-full mb-2" />
          <p className="mb-2">Welcome, {user.displayName}</p>
          <button onClick={handleSignOut} className="bg-red-500 text-white px-4 py-2 rounded">Sign Out</button>
        </>
      ) : (
        <button onClick={handleSignIn} className="bg-blue-500 text-white px-4 py-2 rounded">Sign in with Google</button>
      )}
    </div>
  );
}

export default Auth;
