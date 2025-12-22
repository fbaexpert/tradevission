
import { unstable_noStore as noStore } from 'next/cache';
import Link from "next/link";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { collection, query, where, orderBy, getDocs, doc, getDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/config";

interface FooterSettings {
    contact: string;
    copyright: string;
}

interface PageCategory {
  id: string;
  name: string;
}

interface WebPage {
    id: string;
    title: string;
    slug: string;
    category: string;
}

const defaultFooterSettings: FooterSettings = {
    contact: "support@tradevission.online",
    copyright: "© 2024 TradeVission. All Rights Reserved."
};

async function getFooterData() {
    // This function tells Next.js not to cache the data from this fetch.
    noStore();
    try {
        const { db } = getFirebase();
        const settingsDocRef = doc(db, "site_footer", "content");
        const systemSettingsDocRef = doc(db, "system", "settings");
        const pagesQuery = query(collection(db, "websitePages"), where("isActive", "==", true), where("inFooter", "==", true), orderBy("order", "asc"));
        
        const [settingsDoc, systemSettingsDoc, pagesSnapshot] = await Promise.all([
            getDoc(settingsDocRef),
            getDoc(systemSettingsDocRef),
            getDocs(pagesQuery),
        ]);

        const settings = settingsDoc.exists() ? settingsDoc.data() as FooterSettings : defaultFooterSettings;
        const pageCategories = systemSettingsDoc.exists() ? systemSettingsDoc.data().pageCategories || [] : [];
        const pages = pagesSnapshot.docs.map(doc => doc.data() as WebPage);

        const groupedPages = pageCategories.map((category: PageCategory) => ({
            ...category,
            pages: pages.filter(page => page.category === category.name)
        })).filter((category: any) => category.pages.length > 0);

        return { settings, groupedPages };
    } catch (error) {
        console.error("Error fetching footer data: ", error);
        return { settings: defaultFooterSettings, groupedPages: [] };
    }
}


export async function Footer() {
  const { settings, groupedPages } = await getFooterData();

  return (
    <footer className="border-t border-border/20 bg-background text-foreground">
        <div className="container mx-auto px-6 py-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center md:text-left">
                {/* Column 1: Logo and Tagline */}
                <div className="flex flex-col items-center md:items-start space-y-4 lg:col-span-1">
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
                
                {/* Dynamically generated columns */}
                {groupedPages.map((category: any) => (
                    <div key={category.id} className="flex flex-col items-center md:items-start">
                        <h4 className="font-bold text-white mb-4">{category.name}</h4>
                        <ul className="space-y-2">
                           {category.pages.map((page: WebPage) => (
                               <li key={page.slug}>
                                   <Link href={`/${page.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                                       {page.title}
                                   </Link>
                               </li>
                           ))}
                        </ul>
                    </div>
                ))}


                {/* Column for Contact Info */}
                <div className="flex flex-col items-center md:items-start">
                     <h4 className="font-bold text-white mb-4">Contact Us</h4>
                    <a href={`mailto:${settings.contact}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="h-4 w-4"/>
                        {settings.contact}
                    </a>
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

