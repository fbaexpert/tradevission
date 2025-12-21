
"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { collection, onSnapshot, query, orderBy, doc } from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";

interface DynamicPage {
  id: string;
  title: string;
  category: string;
}

interface FooterSettings {
    description: string;
    contactEmail: string;
    copyrightText: string;
}

const defaultFooterSettings: FooterSettings = {
    description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
    contactEmail: "tradevissionn@gmail.com",
    copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
};

export function Footer() {
  const { db } = useFirebase();
  const [pages, setPages] = useState<DynamicPage[]>([]);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(defaultFooterSettings);

  useEffect(() => {
    if (!db) return;
    
    // Listener for dynamic pages from the correct 'pages' collection
    const pagesQuery = query(collection(db, "pages"), orderBy("order", "asc"));
    const unsubscribePages = onSnapshot(pagesQuery, (snapshot) => {
        const pagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DynamicPage));
        setPages(pagesData);
    });

    // Listener for footer settings
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists() && doc.data().footer) {
            setFooterSettings(doc.data().footer);
        } else {
            setFooterSettings(defaultFooterSettings);
        }
    });

    return () => {
        unsubscribePages();
        unsubscribeSettings();
    };
  }, [db]);

  const groupedPages = useMemo(() => {
    // Filter out unwanted pages before grouping
    const filteredPages = pages.filter(page => 
        page.title.toLowerCase() !== 'about' && 
        page.title.toLowerCase() !== 'hello'
    );
      
    return filteredPages.reduce((acc, page) => {
        const category = page.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(page);
        return acc;
    }, {} as Record<string, DynamicPage[]>);
  }, [pages]);

  return (
    <footer className="border-t border-border/20 py-12 px-6 bg-background">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1 space-y-4">
               <div className="flex items-center gap-3">
                  <Logo />
                  <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
                      TradeVission
                  </h1>
              </div>
               <p className="text-muted-foreground text-sm">{footerSettings.description}</p>
            </div>

            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-8">
                {Object.entries(groupedPages).map(([category, pagesInCategory]) => (
                  <div key={category}>
                      <h4 className="font-bold text-white mb-4">{category}</h4>
                      <nav className="flex flex-col gap-2">
                          {pagesInCategory.map(page => (
                              <Link key={page.id} href={`/page/${page.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                {page.title}
                              </Link>
                          ))}
                      </nav>
                  </div>
                ))}
            </div>

             <div>
                  <h4 className="font-bold text-white mb-4">Contact Us</h4>
                  <div className="flex flex-col gap-3">
                      <a href={`mailto:${footerSettings.contactEmail}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                          <Mail className="h-4 w-4"/>
                          {footerSettings.contactEmail}
                      </a>
                  </div>
            </div>
        </div>
         <div className="mt-12 pt-8 border-t border-border/20 text-center">
             <p className="text-sm text-muted-foreground">
                {footerSettings.copyrightText}
            </p>
         </div>
    </footer>
  );
}
