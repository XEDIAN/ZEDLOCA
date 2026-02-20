import React from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';


function Auth({ onRoleSelected }) {
  const [user, setUser] = React.useState(null);
  const [role, setRole] = React.useState(null);
  const [showRoleSelect, setShowRoleSelect] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        // Always enable role selection for new users (no Firestore doc or no role)
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.role) {
            setRole(data.role);
            setShowRoleSelect(false);
          } else {
            setShowRoleSelect(true);
          }
        } else {
          // New user: show role selection
          setShowRoleSelect(true);
        }
      } else {
        setRole(null);
        setShowRoleSelect(false);
      }
    });
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

  const handleRoleSelect = async (selectedRole) => {
    if (!user) return;
    setLoading(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL || '',
        role: selectedRole,
        updatedAt: new Date(),
      }, { merge: true });
      setRole(selectedRole);
      setShowRoleSelect(false);
      if (onRoleSelected) {
        onRoleSelected(selectedRole);
      }
    } catch (err) {
      alert('Failed to set role: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center mt-8">
      {user ? (
        showRoleSelect ? (
          <div className="bg-white p-4 rounded shadow flex flex-col items-center">
            <p className="mb-2">Select your role:</p>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded mb-2 w-full"
              onClick={() => handleRoleSelect('buyer')}
              disabled={loading}
            >
              Buyer
            </button>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded mb-2 w-full"
              onClick={() => handleRoleSelect('seller')}
              disabled={loading}
            >
              Seller
            </button>
            <button
              className="mt-2 text-sm text-gray-500 underline"
              onClick={handleSignOut}
            >
              Sign out
            </button>
          </div>
        ) : null
      ) : (
        <div className="flex flex-col items-center space-y-4">
          <button onClick={handleSignIn} className="bg-gray-700 text-white px-3 py-2 md:px-4 md:py-2 rounded text-base md:text-lg w-full max-w-xs">Sign in with Google</button>
        </div>
      )}
    </div>
  );
}

export default Auth;
