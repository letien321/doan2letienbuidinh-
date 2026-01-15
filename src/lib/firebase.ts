// src/lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBNsjW_qxnxJbJjowf-q19cjWtKCGs6VIQ",
  authDomain: "appdo-923d8.firebaseapp.com",
  databaseURL: "https://appdo-923d8-default-rtdb.firebaseio.com",
  projectId: "appdo-923d8",
  storageBucket: "appdo-923d8.firebasestorage.app",
  messagingSenderId: "591992071300",
  appId: "1:591992071300:web:90c6fd39cc9bff7ac74ed1",
  measurementId: "G-P6YYKJ3BQL",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

let anonPromise: Promise<User | null> | null = null;

function waitAuthReady() {
  return new Promise<User | null>((resolve) => {
    const off = onAuthStateChanged(auth, (u) => {
      off();
      resolve(u);
    });
  });
}

export async function ensureAnonAuth(): Promise<User | null> {
  if (anonPromise) return anonPromise;

  anonPromise = (async () => {
    // đợi auth init xong
    await waitAuthReady();

    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
    return auth.currentUser;
  })();

  return anonPromise;
}
