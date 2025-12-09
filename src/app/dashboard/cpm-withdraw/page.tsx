
"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { collection, addDoc, doc, onSnapshot, updateDoc, increment, serverTimestamp, writeBatch, getDoc, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Coins, LoaderCircle, AlertCircle, Info, ChevronDown, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface CpmCoinData {
    amount?: number;
}

interface UserData {
    cpmWithdrawalStatus?: 'enabled' | 'disabled';
}

interface CpmWithdrawalSettings {
    open: boolean;
}

interface CpmCoinPackage {
  id: string;
  name: string;
  coinAmount: number;
  price: number;
}

interface CpmPresaleSettings {
  packages: CpmCoinPackage[];
}

export default function CpmWithdrawPage() {
  const { user } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [coinData, setCoinData] = useState<CpmCoinData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<CpmWithdrawalSettings | null>(null);
  const [presaleSettings, setPresaleSettings] = useState<CpmPresaleSettings | null>(null);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState(false);

  useEffect(() => {
    if (user && db) {
        const coinDocRef = doc(db, 'cpm_coins', user.uid);
        const unsubscribeCoin = onSnapshot(coinDocRef, (doc) => {
            if(doc.exists()) {
                setCoinData(doc.data() as CpmCoinData);
            } else {
                setCoinData({ amount: 0 });
            }
        });
        
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
            if(doc.exists()){
                setUserData(doc.data() as UserData);
            }
        });
        
        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
            if(doc.exists()){
                const data = doc.data();
                setSettings(data.cpmWithdrawal || { open: true });
                setPresaleSettings(data.cpmPresale || null);
            }
        });

        const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
        const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
            setHasActivePlan(!snapshot.empty);
        });

        return () => {
            unsubscribeCoin();
            unsubscribeUser();
            unsubscribeSettings();
            unsubscribePlans();
        };
    }
  }, [user, db]);

  const bestPricePerCoin = useMemo(() => {
    if (!presaleSettings || !presaleSettings.packages || presaleSettings.packages.length === 0) {
        return null;
    }
    // Find the minimum price per coin across all packages
    return presaleSettings.packages.reduce((minPrice, pkg) => {
        if (pkg.coinAmount > 0) {
            const pricePerCoin = pkg.price / pkg.coinAmount;
            return Math.min(minPrice, pricePerCoin);
        }
        return minPrice;
    }, Infinity);
  }, [presaleSettings]);
  
  const withdrawValueUSD = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (!isNaN(numAmount) && bestPricePerCoin && bestPricePerCoin !== Infinity) {
        return numAmount * bestPricePerCoin;
    }
    return 0;
  }, [amount, bestPricePerCoin]);

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !db) {
      setError("You must be logged in to make a withdrawal.");
      return;
    }
    
    const withdrawAmount = parseInt(amount, 10);
    const currentBalance = coinData?.amount ?? 0;
    
    if (isNaN(withdrawAmount) || withdrawAmount < 10) {
      setError("Minimum withdrawal is 10 CPM Coins.");
      return;
    }
    if (currentBalance < withdrawAmount) {
        setError("Withdrawal amount cannot exceed your current coin balance.");
        return;
    }
    if (!address.trim()) {
      setError("Please enter a valid USDT TRC20 wallet address.");
      return;
    }

    setLoading(true);
    const batch = writeBatch(db);

    const coinDocRef = doc(db, 'cpm_coins', user.uid);
    batch.update(coinDocRef, {
        amount: increment(-withdrawAmount)
    });
    
    const withdrawalRef = doc(collection(db, "cpmWithdrawals"));
    batch.set(withdrawalRef, {
      userId: user.uid,
      userEmail: user.email,
      amount: withdrawAmount,
      walletAddress: address,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, "users", user.uid, "notifications"));
    batch.set(notifRef, {
      userId: user.uid,
      type: 'withdraw',
      title: '➡️ CPM Coin Withdrawal Request Submitted',
      message: `Your withdrawal request for ${withdrawAmount} CPM Coin(s) is being processed.`,
      amount: withdrawAmount,
      status: 'unread',
      seen: false,
      createdAt: serverTimestamp(),
      relatedId: withdrawalRef.id,
    });

    const activityLogRef = doc(collection(db, "activityLogs"));
    batch.set(activityLogRef, {
      userId: user.uid,
      action: 'cpm_withdrawal_requested',
      details: `Requested a withdrawal of ${withdrawAmount} CPM coins.`,
      timestamp: serverTimestamp(),
      relatedId: withdrawalRef.id,
    });

    try {
        await batch.commit();
        toast({
            title: "Withdrawal Request Submitted",
            description: "Your request is pending approval. The coins have been deducted from your balance.",
        });
        router.push("/dashboard");
    } catch (err: any) {
        setError(err.message || "Failed to submit withdrawal request.");
        // Note: Automatic rollback isn't simple with batched writes without more complex logic.
        // The user's coin balance might be deducted even if other parts of the batch fail.
        // A server-side transaction would be more robust for this.
    } finally {
       setLoading(false);
    }
  };
  
  const currentCoinBalance = coinData?.amount ?? 0;
  const isUserDisabled = userData?.cpmWithdrawalStatus === 'disabled';
  const isGloballyDisabled = settings?.open === false;
  const isWithdrawalDisabled = !hasActivePlan || currentCoinBalance < 10 || isUserDisabled || isGloballyDisabled;
  
  let disabledMessage = "";
  if (!hasActivePlan) disabledMessage = "You must have an active investment plan to withdraw.";
  else if (currentCoinBalance < 10) disabledMessage = "Your balance is below the minimum of 10 CPM for withdrawal.";
  else if (isUserDisabled) disabledMessage = "CPM Coin withdrawals for your account have been disabled by an admin. Please contact support.";
  else if (isGloballyDisabled) disabledMessage = "CPM Coin withdrawals are currently disabled by the admin.";

  if (firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)] md:min-h-0">
      <div className="container mx-auto max-w-lg">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
             <div className="flex flex-col items-center gap-4 text-center">
              <Coins className="h-8 w-8 text-accent" />
              <CardTitle className="text-2xl font-bold text-white font-headline">
                Withdraw CPM Coins
              </CardTitle>
               <CardDescription className="text-white font-bold">
                Balance: {currentCoinBalance.toLocaleString()} CPM
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
             <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen} className="mb-6">
                <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full font-bold">
                        <Info className="mr-2 h-4 w-4" />
                        Withdrawal Instructions
                        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", isInstructionsOpen && "rotate-180")} />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                    <div className="p-4 bg-muted/50 border border-border/20 rounded-md text-sm space-y-2">
                        <p>1. Minimum withdrawal is 10 CPM Coins.</p>
                        <p>2. Only USDT TRC20 wallet addresses are supported for CPM Coin withdrawal.</p>
                        <p>3. Ensure your wallet address is correct. Incorrect addresses are not refundable.</p>
                        <p>4. All withdrawal requests are processed manually and may take up to 24 hours.</p>
                        <p>5. Multiple fake requests may lead to account suspension.</p>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            
            {isWithdrawalDisabled && (
                 <Alert className="mb-4 bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                    <Info className="h-4 w-4 !text-yellow-300" />
                    <AlertTitle>Withdrawals Unavailable</AlertTitle>
                    <AlertDescription>{disabledMessage}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleWithdrawal} className="space-y-6">
               <div>
                <Label htmlFor="amount">Amount (CPM Coins)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g., 10"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading || isWithdrawalDisabled}
                  min="10"
                />
                {withdrawValueUSD > 0 && (
                    <div className="mt-2 text-sm text-green-400 font-bold flex items-center gap-1">
                        <DollarSign size={14}/>
                        Value: ~${withdrawValueUSD.toFixed(2)} USD
                    </div>
                )}
              </div>

               <div>
                <Label htmlFor="address">Your USDT TRC20 Wallet Address</Label>
                <Input
                id="address"
                type="text"
                placeholder="Enter your USDT TRC20 address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading || isWithdrawalDisabled}
                />
               </div>
             
              <Button type="submit" className="w-full" disabled={loading || isWithdrawalDisabled}>
                {loading ? <LoaderCircle className="animate-spin" /> : "Submit Request"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
