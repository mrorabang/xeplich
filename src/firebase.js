// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBizj_zdwmLc8gajW1YRXQBpHh9vZlIIU",
  authDomain: "xeplich-b9702.firebaseapp.com",
  projectId: "xeplich-b9702",
  storageBucket: "xeplich-b9702.firebasestorage.app",
  messagingSenderId: "302587348118",
  appId: "1:302587348118:web:5cab12421a4dfa1f0b2eb7",
  measurementId: "G-6TEG65J6Y1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;