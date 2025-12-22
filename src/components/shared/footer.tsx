
import Link from "next/link";
import { Logo } from "./logo";
import { Mail } from "lucide-react";
import { collection, query, orderBy, where, getDocs, doc, getDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase/config";

interface DynamicPage {
  id: string;
  title: string;
  slug: string;
  category: string;
  order: number;
}

interface PageCategory {
  id: string;
  name: string;
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

async function getFooterData() {
  try {
    const { db } = getFirebase();

    const pagesQuery = query(collection(db, "pages"), where("isActive", "==", true), orderBy("order", "asc"));
    const categoriesQuery = query(collection(db, "categories"), orderBy("name", "asc"));
    const settingsDocRef = doc(db, "system", "settings");

    const [pagesSnapshot, categoriesSnapshot, settingsDoc] = await Promise.all([
        getDocs(pagesQuery),
        getDocs(categoriesQuery),
        getDoc(settingsDocRef)
    ]);

    const pages: DynamicPage[] = pagesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DynamicPage));
    const categories: PageCategory[] = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageCategory));
    
    let footerSettings = defaultFooterSettings;
    if (settingsDoc.exists() && settingsDoc.data().footer) {
        footerSettings = { ...defaultFooterSettings, ...settingsDoc.data().footer };
    }

    const groupedPages = categories.map(category => ({
        ...category,
        pages: pages.filter(page => page.category === category.name)
    })).filter(category => category.pages.length > 0);

    return { groupedPages, footerSettings };
  } catch (error) {
    console.error("Failed to fetch footer data on server:", error);
    return { groupedPages: [], footerSettings: defaultFooterSettings };
  }
}

export async function Footer() {
  const { groupedPages, footerSettings } = await getFooterData();

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
                {groupedPages.map((category) => (
                  <div key={category.id}>
                      <h4 className="font-bold text-white mb-4">{category.name}</h4>
                      <nav className="flex flex-col gap-2">
                          {category.pages.map(page => (
                              <Link key={page.id} href={`/legal/${page.slug}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
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
