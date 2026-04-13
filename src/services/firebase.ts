import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDqS4mYq-zqR9z0qz_9sG9_zqR9z0qz_9s",
  authDomain: "donow-app-9a2ca.firebaseapp.com",
  projectId: "donow-app-9a2ca",
  storageBucket: "donow-app-9a2ca-storage",
  messagingSenderId: "1044613297121",
  appId: "1:1044613297121:web:xxx"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;