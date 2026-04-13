import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDdVMNCRzB9cZBHKmeSWvCjlGOsMYAYMrU",
  authDomain: "donow-app-9a2ca.firebaseapp.com",
  projectId: "donow-app-9a2ca",
  storageBucket: "donow-app-9a2ca.firebasestorage.app",
  messagingSenderId: "1044613297121",
  appId: "1:1044613297121:ios:039650993e5d2017cfd8a0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;