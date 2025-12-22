
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";

interface FooterSettings {
    contact: string;
    copyright: string;
}

const defaultFooterSettings: FooterSettings = {
    contact: "support@tradevission.online",
    copyright: "© 2024 TradeVission. All Rights Reserved."
};

export function Footer() {
  const { db } = useFirebase();
  const [settings, setSettings] = useState<FooterSettings>(defaultFooterSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
        setLoading(false);
        return;
    };
    
    const settingsDocRef = doc(db, "site_footer", "content");
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            setSettings(doc.data() as FooterSettings);
        } else {
            setSettings(defaultFooterSettings);
        }
        setLoading(false);
    }, (error) => {
        console.error("Failed to fetch footer settings:", error);
        setSettings(defaultFooterSettings);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  if (loading) {
    return (
        <footer className="border-t border-border/20 py-12 px-6 bg-background animate-pulse">
            <div className="container mx-auto text-center">
                <div className="h-4 bg-muted/50 rounded w-1/4 mx-auto"></div>
            </div>
        </footer>
    )
  }

  return (
    <footer className="border-t border-border/20 py-12 px-6 bg-background">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div className="space-y-4 text-center md:text-left">
               <div className="flex items-center gap-3 justify-center md:justify-start">
                  <Logo />
                  <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
                      TradeVission
                  </h1>
              </div>
               <p className="text-muted-foreground text-sm max-w-sm mx-auto md:mx-0">
                A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.
               </p>
            </div>
             <div className="text-center md:text-right">
                  <h4 className="font-bold text-white mb-4">Contact Us</h4>
                  <div className="flex flex-col gap-3 items-center md:items-end">
                      <a href={`mailto:${settings.contact}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                          <Mail className="h-4 w-4"/>
                          {settings.contact}
                      </a>
                  </div>
            </div>
        </div>
         <div className="mt-12 pt-8 border-t border-border/20 text-center">
             <p className="text-sm text-muted-foreground">
                {settings.copyright}
            </p>
         </div>
    </footer>
  );
}
