
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { collection, addDoc, serverTimestamp, writeBatch, doc, onSnapshot, updateDoc, setDoc, runTransaction, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowDownToDot, LoaderCircle, AlertCircle, Upload, Copy, Info, Zap, Clock, ChevronDown, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";


const CRYPTO_WALLET_ADDRESS = "TDhUm3utKqQ4sE974RCRefAFpdNAVGcLtQ";

interface DepositBoostEvent {
    enabled: boolean;
    title: string;
    bonusPercentage: number;
    endTime: string;
    description: string;
}

const OfferCountdown = ({ targetDate, onEnd }: { targetDate: string; onEnd?: () => void }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const endTime = new Date(targetDate).getTime();
      const difference = endTime - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
        if (onEnd) onEnd();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate, onEnd]);

  return (
    <div className="flex items-center gap-2 text-sm">
      <Clock className="h-4 w-4" />
       <div className="flex justify-center gap-1.5">
        {timeLeft.days > 0 && <span>{timeLeft.days}d</span>}
        <span>{String(timeLeft.hours).padStart(2, '0')}h</span>
        <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>
        <span>{String(timeLeft.seconds).padStart(2, '0')}s</span>
      </div>
       <span>left!</span>
    </div>
  );
};


export default function DepositPage() {
  const { user } = useAuth();
  const { db, storage, loading: firebaseLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [tid, setTid] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [depositBoost, setDepositBoost] = useState<DepositBoostEvent | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);


   useEffect(() => {
    if (!db) return;

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const settings = doc.data();
        const boost = settings.depositBoost;
        if (boost && boost.enabled && new Date() < new Date(boost.endTime)) {
          setDepositBoost(boost);
        } else {
          setDepositBoost(null);
        }
        setSupportEmail(settings.supportEmail || "tradevissionn@gmail.com");
      }
    });

    return () => unsubscribe();
  }, [db]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError("File is too large. Please upload an image under 5MB.");
        return;
      }
      setScreenshotFile(file);
      setError(null);
    }
  };

  const handleDeposit = async () => {
    if (!user || !db || !storage) {
      setError("You must be logged in to make a deposit.");
      return;
    }
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      setError("Please enter a valid deposit amount.");
      return;
    }
    if (!tid) {
      setError("Please enter the Transaction ID (TID).");
      return;
    }
     if (!screenshotFile) {
      setError("Please upload a screenshot of your payment confirmation.");
      return;
    }
    
    setLoading(true);
    setError(null);

    // Get a local copy of the file to use after the initial submission
    const fileToUpload = screenshotFile;

    try {
        const depositRef = doc(collection(db, "deposits"));
        const depositId = depositRef.id;

        const batch = writeBatch(db);
        
        batch.set(depositRef, {
            uid: user.uid,
            email: user.email,
            amount: depositAmount,
            method: 'crypto',
            network: 'TRC20',
            walletOrIban: CRYPTO_WALLET_ADDRESS,
            tid: tid,
            screenshotUrl: '', // Initially empty
            status: "pending",
            createdAt: serverTimestamp(),
        });

        const notifRef = doc(collection(db, "users", user.uid, "notifications"));
        batch.set(notifRef, {
            userId: user.uid, type: 'deposit', title: '✅ Deposit Request Received',
            message: `Your deposit request for $${depositAmount.toFixed(2)} has been received and is under review.`,
            amount: depositAmount, status: 'unread', seen: false, createdAt: serverTimestamp(),
            relatedId: depositRef.id,
        });

        const activityLogRef = doc(collection(db, "activityLogs"));
        batch.set(activityLogRef, {
            userId: user.uid, action: 'deposit_submitted',
            details: `Submitted a deposit request of $${depositAmount.toFixed(2)} via crypto.`,
            timestamp: serverTimestamp(), relatedId: depositRef.id,
        });
        
        await batch.commit();

        toast({
            title: "Deposit Request Submitted",
            description: "Your request is pending approval. You will be notified shortly.",
        });

        // Clear the form and navigate away immediately for a faster user experience
        setAmount("");
        setTid("");
        setScreenshotFile(null);
        setLoading(false);
        router.push("/dashboard");

        // Upload the screenshot in the background
        const storageRef = ref(storage, `deposit_screenshots/${user.uid}/${depositId}`);
        uploadBytes(storageRef, fileToUpload).then(snapshot => {
            getDownloadURL(snapshot.ref).then(downloadURL => {
                updateDoc(depositRef, { screenshotUrl: downloadURL });
            });
        }).catch(uploadError => {
            console.error("Background screenshot upload failed:", uploadError);
            // Optionally, log this failure to an admin-visible collection
            const errorLogRef = doc(collection(db, "uploadErrors"));
            setDoc(errorLogRef, {
                userId: user.uid,
                depositId: depositId,
                error: uploadError.message,
                timestamp: serverTimestamp()
            });
        });

    } catch (err: any) {
        setError(err.message || "Failed to submit deposit request.");
        setLoading(false);
    }
  };

  if (firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)] md:min-h-0">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-4xl space-y-8">
        
         {depositBoost && (
            <div className="relative overflow-hidden rounded-lg border-2 border-primary/50 bg-gradient-to-br from-primary/20 via-background to-background p-6 text-center shadow-lg shadow-primary/10">
                <div className="absolute -top-10 -right-10 text-primary/10">
                    <Zap size={120} strokeWidth={1}/>
                </div>
                 <div className="absolute -top-1.5 -left-1.5 h-12 w-12 bg-primary animate-ping rounded-full opacity-20" />
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-primary">{depositBoost.title}</h3>
                    <p className="text-muted-foreground mt-1">{depositBoost.description} Get an extra <span className="font-bold text-white">{depositBoost.bonusPercentage}%</span> on all deposits!</p>
                    <div className="mt-4 inline-block rounded-full bg-background/50 px-4 py-2 border border-border/20">
                        <p className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center justify-center gap-2"> Time Left</p>
                        <div className="font-bold text-primary">
                          <OfferCountdown targetDate={depositBoost.endTime} onEnd={() => setDepositBoost(null)} />
                        </div>
                    </div>
                </div>
           </div>
        )}

        <Card className="border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
          <CardHeader className="text-center">
             <ArrowDownToDot className="h-10 w-10 text-accent mx-auto" />
              <CardTitle className="text-3xl font-bold text-white font-headline">
                Make a Deposit
              </CardTitle>
               <CardDescription>
                Follow the steps below to add funds to your account.
              </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8 items-start p-4 sm:p-8">
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-primary/20 border-2 border-primary text-primary font-bold text-lg">1</div>
                    <div>
                        <h4 className="font-bold text-white text-lg">Send USDT</h4>
                        <p className="text-muted-foreground text-sm">Send any amount of USDT on the <strong className="text-white">TRC20 (Tron)</strong> network to the address below.</p>
                    </div>
                </div>

                <div className="p-4 rounded-lg bg-background/50 border border-border/30 text-center space-y-3">
                    
                    <p className="font-mono text-accent break-all text-sm sm:text-base">{CRYPTO_WALLET_ADDRESS}</p>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(CRYPTO_WALLET_ADDRESS)}>
                        <Copy className="mr-2 h-4 w-4" /> Copy Address
                    </Button>
                </div>
                 <Alert>
                    <Info className="h-4 w-4"/>
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                        Only send USDT on the TRC20 network. Sending any other currency or using a different network will result in a permanent loss of funds.
                    </AlertDescription>
                </Alert>
              </div>
              <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-primary/20 border-2 border-primary text-primary font-bold text-lg">2</div>
                    <div>
                        <h4 className="font-bold text-white text-lg">Confirm Your Deposit</h4>
                        <p className="text-muted-foreground text-sm">After sending the funds, fill out the form below with your transaction details.</p>
                    </div>
                </div>
                 {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                 <div className="space-y-4">
                    <div>
                        <Label htmlFor="amount-crypto">Amount Sent (USD)</Label>
                        <Input id="amount-crypto" type="number" placeholder="e.g., 50" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} />
                    </div>
                    <div>
                        <Label htmlFor="tid-crypto">Transaction ID (TID)</Label>
                        <Input id="tid-crypto" type="text" placeholder="Enter the transaction ID" value={tid} onChange={(e) => setTid(e.target.value)} disabled={loading} />
                    </div>
                     <div>
                        <Label htmlFor="screenshot">Payment Screenshot</Label>
                        <Input id="screenshot" type="file" onChange={handleFileChange} accept="image/*" disabled={loading} className="file:text-primary file:font-bold"/>
                         {screenshotFile && (
                          <div className="mt-2 text-sm text-green-400 flex items-center gap-2">
                            <CheckCircle className="h-4 w-4" />
                            <span>{screenshotFile.name}</span>
                          </div>
                        )}
                    </div>
                    <Button onClick={handleDeposit} className="w-full" disabled={loading}>
                        {loading ? <LoaderCircle className="animate-spin" /> : <Upload />}
                        <span>Submit Deposit</span>
                    </Button>
                </div>
              </div>
          </CardContent>
           <CardContent className="px-4 sm:px-8 pb-8 space-y-4">
                 <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
                    <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full font-bold">
                            <Info className="mr-2 h-4 w-4" />
                            How to Deposit
                            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", isInstructionsOpen && "rotate-180")} />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2">
                        <div className="p-4 bg-muted/50 border border-border/20 rounded-md text-sm space-y-3">
                            <p><strong>1. Copy Address:</strong> Tap the "Copy Address" button to copy our USDT TRC20 wallet address.</p>
                            <p><strong>2. Go to your Exchange/Wallet:</strong> Open the app or website where you hold your cryptocurrency (e.g., Binance, Coinbase, Trust Wallet).</p>
                            <p><strong>3. Initiate Withdrawal:</strong> Find the "Withdraw" or "Send" option in your wallet.</p>
                            <p><strong>4. Enter Details:</strong> Select USDT as the coin, paste our wallet address, and choose the TRC20 (Tron) network. Enter the amount you wish to deposit.</p>
                            <p><strong>5. Confirm and Get TID:</strong> After you confirm the transaction, your exchange will provide a Transaction ID (also called TxID or Hash). Copy this ID.</p>
                            <p><strong>6. Submit Here:</strong> Come back to this page, enter the exact amount you sent and paste the Transaction ID into the form, then click "Submit Deposit".</p>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
                <Alert className="bg-blue-900/20 border-blue-500/30">
                    <Info className="h-4 w-4 !text-blue-400" />
                    <AlertTitle className="text-white">Having Issues?</AlertTitle>
                    <AlertDescription className="text-blue-200/80">
                        If you're facing any problems with your deposit, please don't hesitate to contact our team.
                        <div className="mt-4 flex flex-col sm:flex-row gap-3">
                           <Button asChild variant="outline">
                               <Link href="/dashboard/support">Contact Support</Link>
                           </Button>
                           <div className="flex items-center text-sm">
                             <span className="font-bold mr-2 text-blue-300">Email:</span> 
                             <span className="text-white">{supportEmail}</span>
                           </div>
                        </div>
                    </AlertDescription>
                </Alert>
           </CardContent>
        </Card>
      </div>
    </div>
  );
}
