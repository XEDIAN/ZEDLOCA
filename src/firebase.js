
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgC8HWjuyT7jVLubWFziFX6eYS_B28aAQ",
  authDomain: "zedloca.firebaseapp.com",
  projectId: "zedloca",
  storageBucket: "zedloca.appspot.com",
  messagingSenderId: "977523495380",
  appId: "1:977523495380:web:e75b89fa7601fc9e9ac641"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
  } else if (err.code == 'unimplemented') {
    console.log('The current browser does not support all of the features required to enable persistence');
  }
});
