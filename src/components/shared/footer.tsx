
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { LegalDialog } from "./legal-dialog";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { collection, doc, onSnapshot, query, where, orderBy } from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";

interface FooterSettings {
    description: string;
    contactEmail: string;
    copyrightText: string;
}

interface DynamicLegalPage {
  id: string;
  title: string;
  slug: string;
  category: 'Legal' | 'Privacy' | 'Terms' | 'Policies' | 'Help';
  order: number;
}

export function Footer() {
  const pathname = usePathname();
  const { db } = useFirebase();
  const isInDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<string>('privacy-policy');
  
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
      description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
      contactEmail: "tradevissionn@gmail.com",
      copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
  });

  const [dynamicPages, setDynamicPages] = useState<DynamicLegalPage[]>([]);

  useEffect(() => {
    if (!db) return;
    
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if(doc.exists()) {
            const data = doc.data();
            if (data.footer) {
                setFooterSettings(data.footer);
            }
        }
    });

    const pagesQuery = query(collection(db, "websitePages"), where("isActive", "==", true), orderBy("order", "asc"));
    
    const unsubscribePages = onSnapshot(pagesQuery, (snapshot) => {
        const pages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DynamicLegalPage));
        setDynamicPages(pages);
    }, (error) => {
        console.error("Error fetching website pages for footer:", error);
    });

    return () => {
        unsubscribeSettings();
        unsubscribePages();
    };
  }, [db]);

  const groupedPages = useMemo(() => {
    return dynamicPages.reduce((acc, page) => {
        const category = page.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(page);
        return acc;
    }, {} as Record<string, DynamicLegalPage[]>);
  }, [dynamicPages]);

  const handleLinkClick = (slug: string) => {
    setDialogContent(slug);
    setDialogOpen(true);
  }

  const renderLink = (page: {slug: string, title: string}) => {
      if (isInDashboard) {
        return (
          <button onClick={() => handleLinkClick(page.slug)} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">
            {page.title}
          </button>
        );
      }
      return (
        <Link href={`/legal/${page.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
          {page.title}
        </Link>
      );
  }
  
  const aboutLinks = [
    { label: 'About Us', href: '/#about'},
    { label: 'How It Works', href: '/#how-it-works'},
  ];

  return (
    <>
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
                  <div>
                      <h4 className="font-bold text-white mb-4">About</h4>
                      <nav className="flex flex-col gap-2">
                        {aboutLinks.map(link => (
                             <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-primary transition-colors">{link.label}</Link>
                        ))}
                      </nav>
                  </div>
                  {Object.entries(groupedPages).map(([category, pages]) => (
                    <div key={category}>
                        <h4 className="font-bold text-white mb-4">{category}</h4>
                        <nav className="flex flex-col gap-2">
                            {pages.map(page => (
                                <div key={page.id}>
                                   {renderLink(page)}
                                </div>
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
      {isInDashboard && <LegalDialog open={dialogOpen} onOpenChange={setDialogOpen} content={dialogContent} />}
    </>
  );
}
