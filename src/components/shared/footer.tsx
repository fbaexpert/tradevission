
"use client"

import Link from "next/link";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { collection, doc, onSnapshot, query, where, orderBy, getDocs } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { unstable_noStore as noStore } from 'next/cache';

interface FooterSettings {
  supportEmail: string;
  copyrightText: string;
}

interface PageLink {
    slug: string;
    title: string;
    category: string;
}

const getFooterData = async () => {
    noStore();
    const { db } = getFirebase();
    
    let settings: FooterSettings = {
        supportEmail: "support@tradevission.online",
        copyrightText: "© 2024 TradeVission. All Rights Reserved."
    };
    let pages: PageLink[] = [];

    try {
        const settingsDocRef = doc(db, "system", "settings");
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            if (data.footer) {
                settings = data.footer;
            }
        }

        const pagesQuery = query(
            collection(db, "websitePages"), 
            where("inFooter", "==", true), 
            where("isActive", "==", true),
            orderBy("order", "asc")
        );
        const pagesSnapshot = await getDocs(pagesQuery);
        pages = pagesSnapshot.docs.map(doc => doc.data() as PageLink);
        
    } catch (error) {
        console.error("Failed to fetch footer data:", error);
    }
    
    return { settings, pages };
};


export function Footer() {
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
    supportEmail: "tradevissionn@gmail.com",
    copyrightText: "© 2023-2025 TradeVission. All Rights Reserved."
  });
  const [pages, setPages] = useState<PageLink[]>([]);

  useEffect(() => {
    const { db } = getFirebase();
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists() && doc.data().footer) {
        setFooterSettings(doc.data().footer);
      }
    });

    const pagesQuery = query(collection(db, "websitePages"), orderBy("order", "asc"));
    const unsubscribePages = onSnapshot(pagesQuery, (snapshot) => {
        const activePages = snapshot.docs
            .map(doc => doc.data() as PageLink)
            .filter(page => (page as any).isActive && (page as any).inFooter);
        setPages(activePages);
    });

    return () => {
        unsubscribeSettings();
        unsubscribePages();
    };
  }, []);

  const groupedPages = useMemo(() => {
    return pages.reduce((acc, page) => {
        const category = page.category || 'General';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(page);
        return acc;
    }, {} as Record<string, PageLink[]>);
  }, [pages]);

  return (
    <footer className="border-t border-border/20 bg-background text-foreground">
      <div className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col md:col-span-2 items-center text-center md:items-start md:text-left space-y-4">
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

          {Object.entries(groupedPages).map(([category, links]) => (
             <div key={category}>
                <h4 className="font-bold text-white mb-4">{category}</h4>
                <ul className="space-y-2">
                    {links.map(link => (
                        <li key={link.slug}>
                            <Link href={`/${link.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                {link.title}
                            </Link>
                        </li>
                    ))}
                </ul>
             </div>
          ))}

          <div>
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
