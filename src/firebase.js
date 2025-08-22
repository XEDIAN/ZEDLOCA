
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCgC8HWjuyT7jVLubWFziFX6eYS_B28aAQ",
  authDomain: "zedloca.firebaseapp.com",
  projectId: "zedloca",
  storageBucket: "zedloca.firebasestorage.app",
  messagingSenderId: "977523495380",
  appId: "1:977523495380:web:e75b89fa7601fc9e9ac641"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
