
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { getFirebase } from "@/lib/firebase/config";
import { collection, addDoc, doc, onSnapshot, updateDoc, increment, serverTimestamp, writeBatch, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpFromDot, LoaderCircle, AlertCircle, Info, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const cryptoOptions = ["TRC20 USDT", "ERC20 USDT", "BNB (BEP20)", "BTC"];

interface WithdrawalSettings {
    open: boolean;
    startTime: string;
    endTime: string;
    offDays: string[];
}

interface UserData {
    withdrawalStatus?: 'enabled' | 'disabled';
    balance0?: number;
    balance?: number;
}

export default function WithdrawPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [coin, setCoin] = useState(cryptoOptions[0]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
  const [supportEmail, setSupportEmail] = useState("");
  const [serverTime, setServerTime] = useState<Date | null>(new Date());
  const [isWithinTime, setIsWithinTime] = useState(false);
  const [isWorkingDay, setIsWorkingDay] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState(false);


  useEffect(() => {
    if (user) {
        const { db } = getFirebase();
        
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
            if(doc.exists()) {
                setUserData(doc.data() as UserData);
            }
        });

        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSettings(data.withdrawal || null);
                setSupportEmail(data.supportEmail || "tradevissionn@gmail.com");
            }
        });

        const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
        const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
            setHasActivePlan(!snapshot.empty);
        });

        const timer = setInterval(() => setServerTime(new Date()), 1000);

        return () => {
            unsubscribeUser();
            unsubscribeSettings();
            unsubscribePlans();
            clearInterval(timer);
        };
    }
  }, [user]);

  useEffect(() => {
    if (settings && serverTime) {
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const currentDay = dayNames[serverTime.getDay()];
      const offDays = settings.offDays || [];
      setIsWorkingDay(!offDays.includes(currentDay));

      const [startHour, startMinute] = settings.startTime.split(':').map(Number);
      const [endHour, endMinute] = settings.endTime.split(':').map(Number);
      
      const currentTimeInMinutes = serverTime.getHours() * 60 + serverTime.getMinutes();
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      setIsWithinTime(currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes);
    }
  }, [settings, serverTime]);

  const handleWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError("You must be logged in to make a withdrawal.");
      return;
    }
    
    const withdrawAmount = parseFloat(amount);
    const currentBalance = userData?.balance0 ?? userData?.balance ?? 0;
    
    if (isNaN(withdrawAmount) || withdrawAmount < 1) {
      setError("Minimum withdrawal amount is $1.");
      return;
    }
    if (withdrawAmount > 50000) {
      setError("Maximum withdrawal amount is $50,000.");
      return;
    }
    if (currentBalance === null || withdrawAmount > currentBalance) {
        setError("Withdrawal amount cannot exceed your current balance.");
        return;
    }
    if (!address.trim()) {
      setError("Please enter a valid wallet address.");
      return;
    }
    
    setLoading(true);
    const { db } = getFirebase();
    const batch = writeBatch(db);

    const userDocRef = doc(db, 'users', user.uid);
    batch.update(userDocRef, {
        balance0: increment(-withdrawAmount)
    });
    
    const withdrawalRef = doc(collection(db, "withdrawals"));
    batch.set(withdrawalRef, {
      userId: user.uid,
      userEmail: user.email,
      amount: withdrawAmount,
      method: "crypto",
      coin: coin,
      walletAddress: address,
      status: "pending",
      createdAt: serverTimestamp(),
    });

    const notifRef = doc(collection(db, "users", user.uid, "notifications"));
    batch.set(notifRef, {
      userId: user.uid,
      type: 'withdraw',
      title: '➡️ Withdrawal Request Submitted',
      message: `Your withdrawal request for $${withdrawAmount.toFixed(2)} is being processed.`,
      amount: withdrawAmount,
      status: 'unread',
      seen: false,
      createdAt: serverTimestamp(),
      relatedId: withdrawalRef.id,
    });

    const activityLogRef = doc(collection(db, "activityLogs"));
    batch.set(activityLogRef, {
      userId: user.uid,
      action: 'withdrawal_requested',
      details: `Requested a withdrawal of $${withdrawAmount.toFixed(2)} via crypto.`,
      timestamp: serverTimestamp(),
      relatedId: withdrawalRef.id,
    });

    batch.commit().then(() => {
        toast({
            title: "Withdrawal Request Submitted",
            description: "Your request is pending approval. The amount has been deducted from your balance.",
        });
        router.push("/dashboard");
    }).catch(async (err) => {
        setError(err.message || "Failed to submit withdrawal request.");
        if(user) {
            // Rollback balance deduction on failure
            await updateDoc(userDocRef, {
                balance0: increment(withdrawAmount)
            });
        }
    }).finally(() => {
       setLoading(false);
    });
  };
  
  const currentBalance = userData?.balance0 ?? userData?.balance ?? 0;
  const isUserDisabled = userData?.withdrawalStatus === 'disabled';
  const isWithdrawalDisabled = !hasActivePlan || !settings?.open || !isWithinTime || !isWorkingDay || currentBalance === 0 || isUserDisabled;
  
  let disabledMessage = "";
  if (!hasActivePlan) disabledMessage = "You must have an active investment plan to withdraw.";
  else if (currentBalance === 0) disabledMessage = "Your balance is currently empty. Please add funds to enable withdrawals.";
  else if (isUserDisabled) disabledMessage = "Withdrawals for your account have been disabled by an admin. Please contact support.";
  else if (!settings?.open) disabledMessage = "Withdrawals are currently disabled by the admin.";
  else if (!isWorkingDay) disabledMessage = "Withdrawals are closed today. Please try again on working days.";
  else if (!isWithinTime) disabledMessage = `Withdrawals are only available between ${settings.startTime} and ${settings.endTime} (Server Time).`;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-lg">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
             <div className="flex flex-col items-center gap-4 text-center">
              <ArrowUpFromDot className="h-8 w-8 text-accent" />
              <CardTitle className="text-2xl font-bold text-white font-headline">
                Request Withdrawal
              </CardTitle>
               <CardDescription className="text-white font-bold">
                Balance: ${currentBalance?.toFixed(2) ?? 'Loading...'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
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
                        <p>1) Minimum withdrawal amount is $1. Withdrawals below $1 are not allowed.</p>
                        {settings && settings.offDays.length > 0 && <p>2) Withdrawals are OFF on {settings.offDays.join(", ")}.</p>}
                        {settings && <p>3) Withdrawal active time: {settings.startTime} to {settings.endTime} (Server Time).</p>}
                        <p>4) Incorrect wallet address will not be refundable.</p>
                        <p>5) Multiple fake requests may lead to account suspension.</p>
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
                    <AlertTitle>Withdrawals Closed</AlertTitle>
                    <AlertDescription>{disabledMessage}</AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleWithdrawal} className="space-y-6">
               <div>
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="e.g., 50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading || isWithdrawalDisabled}
                  min="1"
                  max="50000"
                />
              </div>

               <div className="space-y-4">
                    <div>
                        <Label htmlFor="coin">Coin</Label>
                         <Select value={coin} onValueChange={setCoin} disabled={loading || isWithdrawalDisabled}>
                            <SelectTrigger id="coin">
                                <SelectValue placeholder="Select a coin" />
                            </SelectTrigger>
                            <SelectContent>
                                {cryptoOptions.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="address">Your Wallet Address</Label>
                        <Input
                        id="address"
                        type="text"
                        placeholder={`Enter your ${coin} address`}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={loading || isWithdrawalDisabled}
                        />
                    </div>
                </div>
             
              <Button type="submit" className="w-full" disabled={loading || currentBalance === null || isWithdrawalDisabled}>
                {loading ? <LoaderCircle className="animate-spin" /> : "Submit Request"}
              </Button>
            </form>

             <Alert className="mt-6 bg-blue-900/20 border-blue-500/30">
                <Info className="h-4 w-4 !text-blue-400" />
                <AlertTitle className="text-white">Having Issues?</AlertTitle>
                <AlertDescription className="text-blue-200/80">
                    If you're facing any problems with your withdrawal, please don't hesitate to contact our team.
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
