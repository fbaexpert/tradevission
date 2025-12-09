
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getFirebase } from "./config"; 
import { Auth, onAuthStateChanged, User } from "firebase/auth";
import { Firestore } from "firebase/firestore";
import { FirebaseStorage } from "firebase/storage";
import { FirebaseApp } from "firebase/app";

interface FirebaseContextType {
  app: FirebaseApp | null;
  auth: Auth | null;
  db: Firestore | null;
  storage: FirebaseStorage | null;
  user: User | null;
  loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  auth: null,
  db: null,
  storage: null,
  user: null,
  loading: true,
});

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const [services, setServices] = useState<Omit<FirebaseContextType, 'user' | 'loading'>>({ app: null, auth: null, db: null, storage: null });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { app, auth, db, storage } = getFirebase();
    setServices({ app, auth, db, storage });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <FirebaseContext.Provider value={{ ...services, user, loading }}>
      {!loading && children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseContextType => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
};
