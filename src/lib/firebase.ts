import { initializeApp, getApps, getApp } from "firebase/app";
import { browserLocalPersistence, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth } from "firebase/auth";

// Your web app's Firebase configuration from the .env.local file
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase for SSR
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Firebase services
// No popupRedirectResolver here: the default `getAuth()` loads the auth iframe + gapi (~130 KB) on every page.
// The login page passes `browserPopupRedirectResolver` explicitly to signInWithPopup/Redirect/getRedirectResult.
const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
const googleProvider = new GoogleAuthProvider();

// Client Firestore is intentionally not initialised: every read/write goes through /api/* (Module 05 dropped it from the bundle).
export { app, auth, googleProvider };