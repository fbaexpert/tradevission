
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyAz5gy2gkgEllMxC8roSx4smnLpls2zbjo",
  authDomain: "tradevision-82417.firebaseapp.com",
  projectId: "tradevision-82417",
  storageBucket: "tradevision-82417.appspot.com",
  messagingSenderId: "444475824634",
  appId: "1:444475824634:web:91a594098e12117e6a6c43",
  measurementId: "G-NWLFDSESBN"
};

type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: ReturnType<typeof getFunctions>;
};

let services: FirebaseServices | null = null;

export const getFirebase = (): FirebaseServices => {
    if (services) {
        return services;
    }

    const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);
    const functions = getFunctions(app);

    services = { app, auth, db, storage, functions };
    
    return services;
};
