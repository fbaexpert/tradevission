
"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import Loader from "@/components/shared/loader";
import { MaintenanceScreen } from "@/components/shared/maintenance-screen";
import { usePathname } from "next/navigation";
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
  const { user, db, loading: firebaseLoading } = useFirebase();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    if (!db) return;

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            setSettings(doc.data() as AppSettings);
        } else {
            setSettings({ maintenanceMode: false });
        }
        setSettingsLoading(false);
    });

    return () => {
        unsubscribeSettings();
    };
  }, [db]);

  const loading = firebaseLoading || settingsLoading;

  const isUserAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  const isMaintenanceMode = settings?.maintenanceMode === true;
  const isAdminPage = pathname.startsWith('/admin');
  
  if (loading) {
    return <Loader />;
  }
  
  // Show maintenance screen only after settings have been loaded.
  if (isMaintenanceMode && !isUserAdmin && !isAdminPage) {
    return <MaintenanceScreen />;
  }

  return (
    <AuthContext.Provider value={{ user, loading: firebaseLoading }}>
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
