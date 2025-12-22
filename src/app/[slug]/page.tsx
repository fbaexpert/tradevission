'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getFirebase } from '@/lib/firebase/config';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LoaderCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface PageContent {
    title: string;
    content: string;
    updatedAt?: Timestamp;
}

export default function DynamicPage() {
    const params = useParams();
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    const { db } = getFirebase();
    
    const [pageContent, setPageContent] = useState<PageContent | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!db || !slug) {
            setLoading(false);
            setError("Page not found.");
            return;
        }

        const fetchPage = async () => {
            setLoading(true);
            try {
                const pageRef = doc(db, "websitePages", slug);
                const docSnap = await getDoc(pageRef);

                if (docSnap.exists()) {
                    setPageContent(docSnap.data() as PageContent);
                } else {
                    setError("The page you are looking for does not exist.");
                }
            } catch (err) {
                console.error(err);
                setError("An error occurred while fetching the page.");
            } finally {
                setLoading(false);
            }
        };
        
        // A temporary workaround for a Firestore query issue in this context
        const fetchWithQuery = async () => {
             setLoading(true);
             try {
                const q = query(collection(db, "websitePages"), where("slug", "==", slug));
                const querySnapshot = await getDocs(q);
                if (!querySnapshot.empty) {
                     setPageContent(querySnapshot.docs[0].data() as PageContent);
                } else {
                     setError("The page you are looking for does not exist.");
                }

             } catch(err) {
                 console.error(err);
                 setError("An error occurred while fetching the page.");
             } finally {
                 setLoading(false);
             }
        }

        fetchWithQuery();
    }, [db, slug]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
            </div>
        );
    }
    
    const lastUpdated = pageContent?.updatedAt;

    return (
        <div className="p-4 sm:p-6 md:p-8 bg-background">
            <div className="container mx-auto max-w-4xl">
                <Card className="border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                     {error ? (
                        <CardHeader className="text-center py-20">
                           <CardTitle className="text-2xl text-destructive">Page Not Found</CardTitle>
                           <CardDescription>{error}</CardDescription>
                        </CardHeader>
                     ) : pageContent && (
                        <>
                            <CardHeader>
                                <FileText className="h-10 w-10 text-primary mb-4" />
                                <CardTitle className="text-3xl font-bold text-white font-headline">{pageContent.title}</CardTitle>
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
                        </>
                    )}
                </Card>
            </div>
        </div>
    );
}

// Added this doc() import that was missing
import { doc, getDoc } from 'firebase/firestore';
