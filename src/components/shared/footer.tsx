
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LegalDialog, LegalPage as LegalPageType } from "./legal-dialog";
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
  order: number;
}

export function Footer() {
  const pathname = usePathname();
  const { db } = useFirebase();
  const isInDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<LegalPageType>('privacy');
  
  const [footerSettings, setFooterSettings] = useState<FooterSettings>({
      description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
      contactEmail: "tradevissionn@gmail.com",
      copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
  });

  const [dynamicLegalLinks, setDynamicLegalLinks] = useState<DynamicLegalPage[]>([]);

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

    const legalQuery = query(collection(db, "legal"), where("inFooter", "==", true), orderBy("order", "asc"));
    const unsubscribeLegal = onSnapshot(legalQuery, (snapshot) => {
        const links = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DynamicLegalPage));
        setDynamicLegalLinks(links);
    });

    return () => {
        unsubscribeSettings();
        unsubscribeLegal();
    };
  }, [db]);

  const handleLinkClick = (slug: LegalPageType) => {
    setDialogContent(slug);
    setDialogOpen(true);
  }

  const renderLink = (page: {slug: string, title: string}) => {
      if (isInDashboard) {
        return (
          <button onClick={() => handleLinkClick(page.slug as LegalPageType)} className="text-sm text-muted-foreground hover:text-primary transition-colors text-left">
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

  const staticLegalLinks = [
    { title: 'Privacy Policy', slug: 'privacy-policy'},
    { title: 'Terms & Conditions', slug: 'terms-and-conditions'},
    { title: 'Refund Policy', slug: 'refund-policy'},
    { title: 'Disclaimer', slug: 'disclaimer'},
  ];

  const staticPolicyLinks = [
    { title: 'Earnings Disclaimer', slug: 'earnings-disclaimer'},
    { title: 'Cookies Policy', slug: 'cookies-policy'},
    { title: 'Risk Warning', slug: 'risk-warning'},
    { title: 'Anti-Fraud Policy', slug: 'anti-fraud-policy'},
    { title: 'Deposit Policy', slug: 'deposit-policy'},
    { title: 'Withdrawal Policy', slug: 'withdrawal-policy'},
    { title: 'Affiliate Terms', slug: 'affiliate-terms'},
    { title: 'KYC Policy', slug: 'kyc-policy'},
  ];

  const allLegalLinks = [...staticLegalLinks, ...dynamicLegalLinks.filter(d => staticLegalLinks.every(s => s.slug !== d.slug))];
  const allPolicyLinks = [...staticPolicyLinks, ...dynamicLegalLinks.filter(d => staticPolicyLinks.every(s => s.slug !== d.slug))];


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
                   <div>
                      <h4 className="font-bold text-white mb-4">Legal</h4>
                      <nav className="flex flex-col gap-2">
                         {allLegalLinks.slice(0, 4).map(link => (
                            <div key={link.slug}>
                              {renderLink(link)}
                            </div>
                         ))}
                      </nav>
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-4">Policies</h4>
                    <nav className="flex flex-col gap-2">
                        {allPolicyLinks.map(link => (
                            <div key={link.slug}>
                               {renderLink(link)}
                            </div>
                         ))}
                    </nav>
                  </div>
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
