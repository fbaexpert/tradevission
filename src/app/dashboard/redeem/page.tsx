
"use client";

import { useState, FormEvent, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/lib/firebase/provider';
import { doc, getDoc, writeBatch, serverTimestamp, increment, collection, query, onSnapshot, orderBy, Timestamp, deleteDoc, arrayUnion } from 'firebase/firestore';
import { nanoid } from 'nanoid';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, LoaderCircle, Gift, KeyRound, Copy, Mailbox, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MailboxItem {
    id: string;
    code: string;
    description: string;
    sentAt: Timestamp;
}

export default function RedeemCodePage() {
  const { user } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [mailboxItems, setMailboxItems] = useState<MailboxItem[]>([]);
  const [loadingMailbox, setLoadingMailbox] = useState(true);

  useEffect(() => {
    if (!user || !db) {
        setLoadingMailbox(false);
        return;
    }
    const q = query(collection(db, "users", user.uid, "vipMailbox"), orderBy("sentAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MailboxItem));
        setMailboxItems(items);
        setLoadingMailbox(false);
    }, (err) => {
        console.error("Error fetching mailbox:", err);
        setLoadingMailbox(false);
    });

    return () => unsubscribe();
  }, [user, db]);

  const sortedMailboxItems = useMemo(() => {
    return mailboxItems.sort((a, b) => b.sentAt.toMillis() - a.sentAt.toMillis());
  }, [mailboxItems]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !db) {
      setError("You must be logged in to redeem a code.");
      return;
    }
    if (!code.trim()) {
      setError("Please enter a redeem code.");
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccess(null);

    const codeRef = doc(db, 'vipCodes', code);

    try {
      const codeDoc = await getDoc(codeRef);
      if (!codeDoc.exists()) {
        throw new Error("Invalid code. Please check the code and try again.");
      }

      const codeData = codeDoc.data();
      if (codeData.status !== 'available') {
        throw new Error("This code has already been redeemed.");
      }
      
      const { rewardType, rewardValue, description, badgeName, badgeColor } = codeData;

      const batch = writeBatch(db);

      // Mark code as redeemed
      batch.update(codeRef, {
        status: 'redeemed',
        redeemedBy: user.uid,
        redeemedByEmail: user.email,
        redeemedAt: serverTimestamp(),
      });
      
      const userRef = doc(db, "users", user.uid);

      // Apply reward
      if (rewardType === 'BALANCE') {
        batch.update(userRef, { balance0: increment(rewardValue) });
      } else if (rewardType === 'CPM_COIN') {
        const coinDocRef = doc(db, "cpm_coins", user.uid);
        batch.set(coinDocRef, {
            amount: increment(rewardValue),
            userId: user.uid,
            lastUpdatedAt: serverTimestamp(),
        }, { merge: true });
      } else if (rewardType === 'VIP_STATUS') {
        const coinDocRef = doc(db, "cpm_coins", user.uid);
        batch.set(coinDocRef, {
            amount: increment(1),
            userId: user.uid,
            lastUpdatedAt: serverTimestamp(),
        }, { merge: true });
      } else if (rewardType === 'CUSTOM_BADGE') {
        batch.update(userRef, {
            customBadges: arrayUnion({ name: badgeName, color: badgeColor, id: nanoid() })
        });
      }

      // Send notification
      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      batch.set(notifRef, {
        userId: user.uid,
        type: 'success',
        title: '🎉 Reward Redeemed!',
        message: `You have successfully redeemed a code for: ${description}.`,
        status: 'unread',
        seen: false,
        createdAt: serverTimestamp(),
        relatedId: code,
      });
      
       const activityLogRef = doc(collection(db, "activityLogs"));
        batch.set(activityLogRef, {
            userId: user.uid,
            action: 'reward_code_redeemed',
            details: `User redeemed code ${code} for reward: ${description}`,
            timestamp: serverTimestamp(),
            relatedId: code
        });

      await batch.commit();

      const successMessage = `Congratulations! You've successfully redeemed: ${description}.`;
      setSuccess(successMessage);
      toast({
        title: "Success!",
        description: successMessage,
        className: 'bg-green-500 text-white',
      });
      setCode('');
      // Check if redeemed code was in mailbox and remove it
      const mailboxItem = mailboxItems.find(item => item.code === code);
      if(mailboxItem){
          await deleteDoc(doc(db, "users", user.uid, "vipMailbox", mailboxItem.id));
      }
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboardAndSet = (text: string) => {
    navigator.clipboard.writeText(text);
    setCode(text);
    toast({ title: "Code Copied & Set!" });
  };
  
   if (firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-8">
      <div className="container mx-auto max-w-lg">
        <Card className="border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="text-center p-8">
             <div className="mx-auto bg-gradient-to-br from-amber-400 to-yellow-500 p-4 rounded-full shadow-lg shadow-amber-500/20 mb-4">
                <Gift className="h-10 w-10 text-white" strokeWidth={2.5}/>
            </div>
            <CardTitle className="text-2xl font-bold text-white mt-2 font-headline">
              Unlock Your Reward
            </CardTitle>
            <CardDescription>
              Enter your reward code below or find it in your VIP Mailbox.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER YOUR CODE"
                className="h-14 text-center text-lg font-bold tracking-widest bg-muted/30 border-2 border-border/30 focus:border-primary"
                disabled={loading}
              />
               {error && (
                  <Alert variant="destructive" className="!mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {success && (
                  <Alert variant="default" className="!mt-4 bg-green-500/10 border-green-500/30 text-green-300">
                    <CheckCircle className="h-4 w-4 !text-green-300" />
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
              <Button type="submit" size="lg" className="w-full !mt-6" disabled={loading}>
                {loading ? <LoaderCircle className="animate-spin" /> : "Unlock Now"}
              </Button>
            </form>
          </CardContent>
           <CardFooter className="p-6 text-center text-xs text-muted-foreground">
             <p>Codes can grant various rewards like account balance, CPM Coins, or VIP status.</p>
          </CardFooter>
        </Card>
      </div>

      <div className="container mx-auto max-w-lg">
        <Card className="border-border/20 shadow-lg shadow-primary/5 bg-muted/20">
          <CardHeader>
              <CardTitle className="flex items-center gap-3 font-bold text-white">
                  <Mailbox /> Your VIP Mailbox
              </CardTitle>
              <CardDescription>
                  Codes sent to you directly by the admin will appear here.
              </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
              {loadingMailbox ? (
                  <div className="flex justify-center p-4"><LoaderCircle className="animate-spin"/></div>
              ) : sortedMailboxItems.length === 0 ? (
                  <p className="text-center text-muted-foreground p-6">Your mailbox is empty.</p>
              ) : (
                <div className="space-y-3">
                  {sortedMailboxItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-3 border rounded-lg bg-background/40">
                          <div>
                              <p className="text-sm text-muted-foreground">{item.description}</p>
                              <p className="font-mono text-lg text-primary">{item.code}</p>
                              <p className="text-xs text-muted-foreground mt-1">Received: {item.sentAt?.toDate().toLocaleString()}</p>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboardAndSet(item.code)}>
                            <Copy className="h-5 w-5"/>
                          </Button>
                      </div>
                  ))}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
