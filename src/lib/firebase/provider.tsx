
"use client";

import { createContext, useContext, ReactNode } from "react";
import { getFirebase } from "./config"; 
import { Auth } from "firebase/auth";
import { Firestore } from "firebase/firestore";
import { FirebaseStorage } from "firebase/storage";
import { FirebaseApp } from "firebase/app";
import { Functions, getFunctions, httpsCallable } from "firebase/functions";

interface FirebaseContextType {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
  functions: Functions;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider = ({ children }: { children: ReactNode }) => {
  const { app, auth, db, storage } = getFirebase();
  const functions = getFunctions(app);
  
  return (
    <FirebaseContext.Provider value={{ app, auth, db, storage, functions }}>
      {children}
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
