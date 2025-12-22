
"use client"

import Link from "next/link";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";

interface FooterSettings {
  supportEmail: string;
  copyrightText: string;
}

export function Footer() {
  const { db } = useFirebase();
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    supportEmail: "tradevissionn@gmail.com",
    copyrightText: "© 2023-2025 TradeVission. All Rights Reserved."
  });

  useEffect(() => {
    if (!db) return;
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.footer) {
          setFooterSettings(data.footer);
        }
      }
    });
    return () => unsubscribe();
  }, [db]);


  return (
    <footer className="border-t border-border/20 bg-background text-foreground">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col items-center text-center md:items-start md:text-left space-y-4">
            <div className="flex items-center gap-3">
              <Logo />
              <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
                TradeVission
              </h1>
            </div>
            <p className="text-muted-foreground text-sm max-w-sm">
              A modern platform to help you navigate the markets, invest in
              your future, and earn daily rewards.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <h4 className="font-bold text-white mb-4">Contact Us</h4>
            <a
              href={`mailto:${footerSettings.supportEmail}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4" />
              {footerSettings.supportEmail}
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/20 text-center">
          <p className="text-sm text-muted-foreground">
            {footerSettings.copyrightText}
          </p>
        </div>
      </div>
    </footer>
  );
}
