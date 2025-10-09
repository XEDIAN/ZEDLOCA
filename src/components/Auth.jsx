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
        <></>
      ) : (
  <button onClick={handleSignIn} className="bg-gray-700 text-white px-3 py-2 md:px-4 md:py-2 rounded text-base md:text-lg w-full max-w-xs">Sign in with Google</button>
      )}
    </div>
  );
}

export default Auth;
