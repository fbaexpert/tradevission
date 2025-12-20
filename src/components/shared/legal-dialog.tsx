
"use client"

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase/provider";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { LoaderCircle } from "lucide-react";
import { format } from "date-fns";

export type LegalPage = 'privacy-policy' | 'terms-and-conditions' | 'refund-policy' | 'disclaimer' | 'earnings-disclaimer' | 'cookies-policy' | 'risk-warning' | 'anti-fraud-policy' | 'deposit-policy' | 'withdrawal-policy' | 'affiliate-terms' | 'kyc-policy' | string;

interface PageContent {
    title: string;
    content: string;
    lastUpdated: Timestamp;
}

interface LegalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    content: LegalPage;
}

export function LegalDialog({ open, onOpenChange, content: slug }: LegalDialogProps) {
  const { db } = useFirebase();
  const [pageContent, setPageContent] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && db && slug) {
      setLoading(true);
      const q = query(collection(db, "legal"), where("slug", "==", slug));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
              setPageContent(snapshot.docs[0].data() as PageContent);
          } else {
              setPageContent(null);
          }
          setLoading(false);
      }, (error) => {
          console.error("Error fetching legal content:", error);
          setPageContent(null);
          setLoading(false);
      });

      return () => unsubscribe();
    }
  }, [open, db, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        {loading ? (
            <>
                <DialogHeader>
                    <DialogTitle>Loading...</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center items-center h-96">
                    <LoaderCircle className="animate-spin" />
                </div>
            </>
        ) : pageContent ? (
          <>
            <DialogHeader>
              <DialogTitle>{pageContent.title}</DialogTitle>
              <DialogDescription>
                Last Updated: {format(pageContent.lastUpdated.toDate(), "PPP")}
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="h-96 pr-6">
                <div 
                    className="prose prose-sm prose-invert max-w-none text-muted-foreground prose-headings:text-white prose-strong:text-white"
                    dangerouslySetInnerHTML={{ __html: pageContent.content.replace(/\n/g, '<br />') }}
                />
            </ScrollArea>
            <DialogFooter>
                <Button onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        ) : (
             <DialogHeader>
              <DialogTitle>Content Not Found</DialogTitle>
              <DialogDescription>
                The content for this page could not be loaded. Please try again later.
              </DialogDescription>
            </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  )
}
