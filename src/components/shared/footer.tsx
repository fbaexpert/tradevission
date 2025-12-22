
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
    <footer className="border-t border-border/20 bg-background text-foreground">
        <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                {/* Column 1: Logo and Tagline */}
                <div className="flex flex-col items-center md:items-start space-y-4">
                    <div className="flex items-center gap-3">
                        <Logo />
                        <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
                            TradeVission
                        </h1>
                    </div>
                    <p className="text-muted-foreground text-sm max-w-sm">
                        A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.
                    </p>
                </div>

                {/* Column 2: Contact Info */}
                <div className="flex flex-col items-center md:items-center">
                     <h4 className="font-bold text-white mb-4">Contact Us</h4>
                    <a href={`mailto:${settings.contact}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="h-4 w-4"/>
                        {settings.contact}
                    </a>
                </div>

                {/* Column 3 can be used for links later if needed */}
                <div className="flex flex-col items-center md:items-end">
                     {/* Placeholder for future links */}
                </div>
            </div>
            
            {/* Bottom Copyright Section */}
            <div className="mt-12 pt-8 border-t border-border/20 text-center">
                <p className="text-sm text-muted-foreground">
                    {settings.copyright}
                </p>
            </div>
        </div>
    </footer>
  );
}
