
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { getFirebase } from '@/lib/firebase/config';
import { notFound } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';

interface PageContent {
    title: string;
    content: string;
    updatedAt?: Timestamp;
}

// This function tells Next.js to re-fetch the data on every request
// and not to cache it. This is important for dynamic content.
export const revalidate = 0;

async function getPageData(slug: string): Promise<PageContent | null> {
    const { db } = getFirebase();
    const pagesRef = collection(db, "websitePages");
    const q = query(pagesRef, where("slug", "==", slug), where("isActive", "==", true));
    
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            return null;
        }
        return querySnapshot.docs[0].data() as PageContent;
    } catch (error) {
        console.error("Error fetching page:", error);
        return null;
    }
}

export default async function DynamicPage({ params }: { params: { slug: string } }) {
    const pageData = await getPageData(params.slug);

    if (!pageData) {
        notFound();
    }

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-4xl">
                <Card className="border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader>
                        <CardTitle className="text-3xl font-bold text-white font-headline">{pageData.title}</CardTitle>
                        {pageData.updatedAt && (
                             <CardDescription>
                                Last Updated: {format(pageData.updatedAt.toDate(), "PPP")}
                            </CardDescription>
                        )}
                    </CardHeader>
                    <CardContent>
                        <div 
                            className="prose prose-invert max-w-none text-muted-foreground prose-headings:text-white prose-strong:text-white"
                            dangerouslySetInnerHTML={{ __html: pageData.content.replace(/\n/g, '<br />') }}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// This function can be used to pre-generate static pages at build time
// for better performance, but we will fetch dynamically for now.
export async function generateStaticParams() {
    const { db } = getFirebase();
    const pagesRef = collection(db, "websitePages");
    const q = query(pagesRef, where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
        slug: doc.data().slug,
    }));
}
