
"use client"

import { useEffect, useState } from 'react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import { useFirebase } from '@/lib/firebase/provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import { format } from "date-fns";
import { useRouter } from 'next/navigation';


interface PageContent {
    title: string;
    content: string;
    updatedAt?: Timestamp;
    createdAt?: Timestamp;
}

export default function LegalPage({ params }: { params: { slug: string } }) {
  const { db } = useFirebase();
  const router = useRouter();
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !params.slug) return;

    const fetchPage = async () => {
      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, "pages", params.slug);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPageContent(docSnap.data() as PageContent);
        } else {
          setError("The page you are looking for does not exist.");
        }
      } catch (err) {
        setError("Failed to load the page content.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [db, params.slug]);

  const lastUpdated = pageContent?.updatedAt || pageContent?.createdAt;

  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
      <header className="py-4 px-6 md:px-12 flex justify-between items-center border-b border-border/20 backdrop-blur-sm sticky top-0 z-50 bg-background/50">
        <Link href="/" className="flex items-center gap-3">
          <Logo />
          <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
            TradeVission
          </h1>
        </Link>
        <nav>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2"/> Back
          </Button>
        </nav>
      </header>
      <main className="flex-grow p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl">
            {loading ? (
                 <div className="flex justify-center items-center h-64">
                    <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
                 </div>
            ) : error ? (
                <Card className="border-destructive/50 bg-destructive/10 text-center">
                    <CardHeader>
                        <CardTitle className="text-destructive">Page Not Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{error}</p>
                        <Button asChild className="mt-4">
                            <Link href="/">Go to Homepage</Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : pageContent && (
                <Card className="border-border/20 shadow-lg shadow-primary/5">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold text-white">{pageContent.title}</CardTitle>
                        {lastUpdated && (
                            <CardDescription>
                                Last Updated: {format(lastUpdated.toDate(), "PPP")}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose prose-invert max-w-none text-muted-foreground prose-headings:text-white prose-strong:text-white"
                            dangerouslySetInnerHTML={{ __html: pageContent.content.replace(/\n/g, '<br />') }}
                        />
                    </CardContent>
                </Card>
            )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

    