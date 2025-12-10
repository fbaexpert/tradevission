
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Loader from "@/components/shared/loader";
import { MaintenanceScreen } from "@/components/shared/maintenance-screen";
import { useFirebase } from "@/lib/firebase/provider";

type AuthContextType = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";

interface AppSettings {
    maintenanceMode: boolean;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { auth, db } = useFirebase();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
    });
    
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            setSettings(doc.data() as AppSettings);
        } else {
            setSettings({ maintenanceMode: false });
        }
        setSettingsLoading(false);
    }, () => {
        setSettings({ maintenanceMode: false });
        setSettingsLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, [auth, db]);

  const isLoading = loading || settingsLoading;
  
  if (isLoading) {
    return <Loader />;
  }
  
  const isUserAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const isMaintenanceMode = settings?.maintenanceMode === true;
  
  if (isMaintenanceMode && !isUserAdmin) {
    return <MaintenanceScreen />;
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
