
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LegalDialog } from "./legal-dialog";
import { Logo } from "./logo";
import { Mail, Phone } from "lucide-react";

type LegalPage = 'privacy' | 'terms' | 'refund' | 'disclaimer' | 'earnings' | 'cookies' | 'risk' | 'anti-fraud' | 'deposit' | 'withdrawal' | 'affiliate' | 'kyc';

export function Footer() {
  const pathname = usePathname();
  const isInDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<LegalPage>('privacy');

  const handleLinkClick = (page: LegalPage) => {
    setDialogContent(page);
    setDialogOpen(true);
  }
  
  const legalLinks: { page: LegalPage; label: string; href: string; }[] = [
    { page: 'privacy', label: 'Privacy Policy', href: '/privacy-policy' },
    { page: 'terms', label: 'Terms & Conditions', href: '/terms-and-conditions' },
    { page: 'refund', label: 'Refund Policy', href: '/refund-policy' },
    { page: 'disclaimer', label: 'Disclaimer', href: '/disclaimer' },
    { page: 'earnings', label: 'Earnings Disclaimer', href: '/earnings-disclaimer' },
    { page: 'cookies', label: 'Cookies Policy', href: '/cookies-policy' },
    { page: 'risk', label: 'Risk Warning', href: '/risk-warning' },
    { page: 'anti-fraud', label: 'Anti-Fraud Policy', href: '/anti-fraud-policy' },
    { page: 'deposit', label: 'Deposit Policy', href: '/deposit-policy' },
    { page: 'withdrawal', label: 'Withdrawal Policy', href: '/withdrawal-policy' },
    { page: 'affiliate', label: 'Affiliate Terms', href: '/affiliate-terms' },
    { page: 'kyc', label: 'KYC Policy', href: '/kyc-policy' },
  ];

  const renderLink = (page: LegalPage, label: string, href: string) => {
      if (isInDashboard) {
        return (
          <button onClick={() => handleLinkClick(page)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {label}
          </button>
        );
      }
      return (
        <Link href={href} className="text-sm text-muted-foreground hover:text-primary transition-colors">
          {label}
        </Link>
      );
  }

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
                 <p className="text-muted-foreground text-sm">A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.</p>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-8">
                  <div>
                      <h4 className="font-bold text-white mb-4">About Us</h4>
                      <nav className="flex flex-col gap-2">
                        <Link href="/#about" className="text-sm text-muted-foreground hover:text-primary transition-colors">About TradeVission</Link>
                        <Link href="/#how-it-works" className="text-sm text-muted-foreground hover:text-primary transition-colors">How It Works</Link>
                      </nav>
                  </div>
                   <div>
                      <h4 className="font-bold text-white mb-4">Legal</h4>
                      <nav className="flex flex-col gap-2">
                         {legalLinks.slice(0, 4).map(link => (
                            <div key={link.page}>
                              {renderLink(link.page, link.label, link.href)}
                            </div>
                         ))}
                      </nav>
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-4">Policies</h4>
                    <nav className="flex flex-col gap-2">
                        {legalLinks.slice(4, 12).map(link => (
                            <div key={link.page}>
                                {renderLink(link.page, link.label, link.href)}
                            </div>
                         ))}
                    </nav>
                  </div>
              </div>

               <div>
                    <h4 className="font-bold text-white mb-4">Contact Us</h4>
                    <div className="flex flex-col gap-3">
                        <a href="mailto:tradevissionn@gmail.com" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                            <Mail className="h-4 w-4"/>
                            tradevissionn@gmail.com
                        </a>
                    </div>
              </div>
          </div>
           <div className="mt-12 pt-8 border-t border-border/20 text-center">
               <p className="text-sm text-muted-foreground">
                  © 2023-2025 TradeVission. All Rights Reserved.
              </p>
           </div>
      </footer>
      {isInDashboard && <LegalDialog open={dialogOpen} onOpenChange={setDialogOpen} content={dialogContent} />}
    </>
  );
}
