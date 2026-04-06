import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCrPuWNbhqz9tHji4EQuLPwofmqmYuBmQc",
  authDomain: "artikelmatch.firebaseapp.com",
  databaseURL: "https://artikelmatch-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "artikelmatch",
  storageBucket: "artikelmatch.firebasestorage.app",
  messagingSenderId: "114813253843",
  appId: "1:114813253843:web:8e343716880f52f76bfc26"
};

// Reuse the existing app if already initialized by src/lib/firebase.ts
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getDatabase(app);
