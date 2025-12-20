
"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { collection, addDoc, doc, onSnapshot, updateDoc, increment, serverTimestamp, writeBatch, query, where, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowUpFromDot, LoaderCircle, AlertCircle, Info, ChevronDown, CheckCircle, ShieldAlert, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { httpsCallable } from 'firebase/functions';

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
    withdrawalVerification?: {
        required?: boolean;
        status?: 'not_verified' | 'pending_otp' | 'verified' | 'locked';
        attempts?: number;
        cooldownUntil?: Timestamp;
    };
}

const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();

            if (difference > 0) {
                const hours = Math.floor(difference / (1000 * 60 * 60));
                const minutes = Math.floor((difference / (1000 * 60)) % 60);
                const seconds = Math.floor((difference / 1000) % 60);
                setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            } else {
                setTimeLeft("00:00:00");
                clearInterval(interval);
                window.location.reload();
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return <span className="font-bold text-2xl text-yellow-400">{timeLeft}</span>;
}

export default function WithdrawPage() {
    const { user } = useAuth();
    const { db, functions } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    // Form states
    const [amount, setAmount] = useState("");
    const [address, setAddress] = useState("");
    const [coin, setCoin] = useState(cryptoOptions[0]);
    const [otp, setOtp] = useState("");
    
    // UI/Flow states
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
    const [supportEmail, setSupportEmail] = useState("");
    const [serverTime, setServerTime] = useState(new Date());
    const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
    const [hasActivePlan, setHasActivePlan] = useState(false);
    
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

    // Data Listeners
    useEffect(() => {
        if (user && db) {
            const userDocRef = doc(db, 'users', user.uid);
            const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
                if (doc.exists()) setUserData(doc.data() as UserData);
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
    }, [user, db]);

    const { isWithinTime, isWorkingDay } = useMemo(() => {
        if (!settings || !serverTime) return { isWithinTime: false, isWorkingDay: false };

        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const currentDay = dayNames[serverTime.getDay()];
        const offDays = settings.offDays || [];
        const workingDay = !offDays.includes(currentDay);

        const [startHour, startMinute] = settings.startTime.split(':').map(Number);
        const [endHour, endMinute] = settings.endTime.split(':').map(Number);
        const currentTimeInMinutes = serverTime.getHours() * 60 + serverTime.getMinutes();
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;

        return {
            isWithinTime: currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes,
            isWorkingDay: workingDay
        };
    }, [settings, serverTime]);
    
    // OTP Functions
    const handleSendOtp = async () => {
        if (isSendingOtp || !functions) return;
        setIsSendingOtp(true);
        setError(null);
        try {
            const sendOtpFunction = httpsCallable(functions, 'sendWithdrawalOtp');
            await sendOtpFunction();
            toast({ title: 'OTP Sent', description: 'A verification code has been sent to your email.' });
        } catch (err: any) {
            setError(err.message || 'Failed to send OTP.');
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || isVerifyingOtp || !functions) return;
        setIsVerifyingOtp(true);
        setError(null);
        try {
            const verifyOtpFunction = httpsCallable(functions, 'verifyWithdrawalOtp');
            await verifyOtpFunction({ otp });
            toast({ title: 'Success', description: 'Your account has been verified for withdrawal.', className: "bg-green-500 text-white" });
            // The onSnapshot listener will update the UI automatically
        } catch (err: any) {
            setError(err.message || 'OTP verification failed.');
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    // Withdrawal Submission
    const handleWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!user || !db) return;

        const withdrawAmount = parseFloat(amount);
        const currentBalance = userData?.balance0 ?? userData?.balance ?? 0;

        if (isNaN(withdrawAmount) || withdrawAmount < 1) {
            setError("Minimum withdrawal amount is $1."); return;
        }
        if (withdrawAmount > 50000) {
            setError("Maximum withdrawal amount is $50,000."); return;
        }
        if (withdrawAmount > currentBalance) {
            setError("Withdrawal amount cannot exceed your current balance."); return;
        }
        if (!address.trim()) {
            setError("Please enter a valid wallet address."); return;
        }

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const userDocRef = doc(db, 'users', user.uid);
            batch.update(userDocRef, { balance0: increment(-withdrawAmount) });

            const withdrawalRef = doc(collection(db, "withdrawals"));
            batch.set(withdrawalRef, {
                userId: user.uid, userEmail: user.email, amount: withdrawAmount,
                method: "crypto", coin: coin, walletAddress: address,
                status: "pending", createdAt: serverTimestamp(),
            });

            const notifRef = doc(collection(db, "users", user.uid, "notifications"));
            batch.set(notifRef, {
                userId: user.uid, type: 'withdraw', title: '➡️ Withdrawal Request Submitted',
                message: `Your withdrawal request for $${withdrawAmount.toFixed(2)} is being processed.`,
                amount: withdrawAmount, status: 'unread', seen: false,
                createdAt: serverTimestamp(), relatedId: withdrawalRef.id,
            });

            const activityLogRef = doc(collection(db, "activityLogs"));
            batch.set(activityLogRef, {
                userId: user.uid, action: 'withdrawal_requested',
                details: `Requested a withdrawal of $${withdrawAmount.toFixed(2)} via crypto.`,
                timestamp: serverTimestamp(), relatedId: withdrawalRef.id,
            });

            await batch.commit();
            toast({
                title: "Withdrawal Request Submitted",
                description: "Your request is pending approval. The amount has been deducted from your balance.",
            });
            router.push("/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to submit withdrawal request.");
            setLoading(false);
        }
    };

    // Derived States
    const needsVerification = userData?.withdrawalVerification?.required && userData.withdrawalVerification.status !== 'verified';
    const isLocked = userData?.withdrawalVerification?.status === 'locked';
    const isOtpPending = userData?.withdrawalVerification?.status === 'pending_otp';
    
    const currentBalance = userData?.balance0 ?? userData?.balance ?? 0;
    const isUserDisabled = userData?.withdrawalStatus === 'disabled';
    const isGloballyDisabled = settings?.open === false;
    const isWithdrawalDisabled = !hasActivePlan || !settings?.open || !isWithinTime || !isWorkingDay || currentBalance === 0 || isUserDisabled || needsVerification;
    
    let disabledMessage = "";
    if (needsVerification) disabledMessage = "Account verification is required before you can withdraw.";
    else if (!hasActivePlan) disabledMessage = "You must have an active investment plan to withdraw.";
    else if (currentBalance === 0) disabledMessage = "Your balance is currently empty.";
    else if (isUserDisabled) disabledMessage = "Withdrawals for your account have been disabled by an admin.";
    else if (isGloballyDisabled) disabledMessage = "Withdrawals are currently disabled by the admin.";
    else if (!isWorkingDay) disabledMessage = `Withdrawals are closed today. Please try again on a working day.`;
    else if (!isWithinTime && settings) disabledMessage = `Withdrawals are only available between ${settings.startTime} and ${settings.endTime} (Server Time).`;

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-lg">
                <Card className="border-border/20 shadow-lg shadow-primary/5">
                    <CardHeader>
                        <div className="flex flex-col items-center gap-4 text-center">
                            <ArrowUpFromDot className="h-8 w-8 text-accent" />
                            <CardTitle className="text-2xl font-bold text-white font-headline">Request Withdrawal</CardTitle>
                            <CardDescription className="text-white font-bold">Balance: ${currentBalance?.toFixed(2) ?? '0.00'}</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {needsVerification ? (
                             <Card className="bg-red-900/20 border-red-500/50 p-6">
                                <CardHeader className="p-0 text-center">
                                     <ShieldAlert className="h-10 w-10 text-red-400 mx-auto" />
                                    <CardTitle className="text-xl text-white">Account Verification Required</CardTitle>
                                    <CardDescription className="text-red-200/80">For your security, please verify your account to enable withdrawals.</CardDescription>
                                </CardHeader>
                                <CardContent className="p-0 mt-6 space-y-4">
                                     {isLocked ? (
                                        <div className="text-center p-4 rounded-lg bg-red-900/50">
                                            <p className="font-bold text-white">Account Locked</p>
                                            <p className="text-sm text-red-200">Too many failed attempts. Please try again in:</p>
                                            {userData?.withdrawalVerification?.cooldownUntil && (
                                                <CountdownTimer targetDate={userData.withdrawalVerification.cooldownUntil.toDate()} />
                                            )}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="otp-email" className="text-white">Your Registered Email</Label>
                                                <div className="flex gap-2">
                                                    <Input id="otp-email" type="email" value={user?.email || ''} readOnly className="bg-background/20" />
                                                    <Button onClick={handleSendOtp} disabled={isSendingOtp}>
                                                        {isSendingOtp ? <LoaderCircle className="animate-spin" /> : "Get OTP"}
                                                    </Button>
                                                </div>
                                            </div>
                                            {isOtpPending && (
                                                <div className="space-y-2">
                                                    <Label htmlFor="otp-code" className="text-white">6-Digit OTP</Label>
                                                    <div className="flex gap-2">
                                                        <Input id="otp-code" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} placeholder="_ _ _ _ _ _" className="text-center tracking-[0.5em] font-mono" />
                                                        <Button onClick={handleVerifyOtp} disabled={isVerifyingOtp || otp.length !== 6}>
                                                            {isVerifyingOtp ? <LoaderCircle className="animate-spin" /> : "Verify"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {error && <p className="text-sm text-red-400 text-center">{error}</p>}
                                </CardContent>
                             </Card>
                        ) : (
                            <>
                                <Collapsible open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
                                    <CollapsibleTrigger asChild>
                                        <Button variant="outline" className="w-full font-bold">
                                            <Info className="mr-2 h-4 w-4" />Withdrawal Instructions<ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", isInstructionsOpen && "rotate-180")} />
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-2">
                                        <div className="p-4 bg-muted/50 border border-border/20 rounded-md text-sm space-y-2">
                                            <p>1) Minimum withdrawal is $1.</p>
                                            {settings && settings.offDays.length > 0 && <p>2) Withdrawals are OFF on {settings.offDays.join(", ")}.</p>}
                                            {settings && <p>3) Withdrawal active time: {settings.startTime} to {settings.endTime} (Server Time).</p>}
                                            <p>4) Incorrect wallet address will not be refundable.</p>
                                            <p>5) Multiple fake requests may lead to account suspension.</p>
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>

                                {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>)}

                                {isWithdrawalDisabled && (<Alert className="bg-yellow-500/10 border-yellow-500/30 text-yellow-300"><Info className="h-4 w-4 !text-yellow-300" /><AlertTitle>Withdrawals Unavailable</AlertTitle><AlertDescription>{disabledMessage}</AlertDescription></Alert>)}

                                <form onSubmit={handleWithdrawal} className="space-y-6">
                                    <div>
                                        <Label htmlFor="amount">Amount (USD)</Label>
                                        <Input id="amount" type="number" placeholder="e.g., 50" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading || isWithdrawalDisabled} min="1" max="50000" />
                                    </div>
                                    <div className="space-y-4">
                                        <div><Label htmlFor="coin">Coin</Label><Select value={coin} onValueChange={setCoin} disabled={loading || isWithdrawalDisabled}><SelectTrigger id="coin"><SelectValue placeholder="Select a coin" /></SelectTrigger><SelectContent>{cryptoOptions.map(opt => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent></Select></div>
                                        <div><Label htmlFor="address">Your Wallet Address</Label><Input id="address" type="text" placeholder={`Enter your ${coin} address`} value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading || isWithdrawalDisabled} /></div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={loading || isWithdrawalDisabled}>{loading ? <LoaderCircle className="animate-spin" /> : "Submit Request"}</Button>
                                </form>
                            </>
                        )}
                        <Alert className="mt-6 bg-blue-900/20 border-blue-500/30">
                            <Info className="h-4 w-4 !text-blue-400" /><AlertTitle className="text-white">Having Issues?</AlertTitle>
                            <AlertDescription className="text-blue-200/80">If you're facing any problems, please don't hesitate to contact our team.<div className="mt-4 flex flex-col sm:flex-row gap-3"><Button asChild variant="outline"><Link href="/dashboard/support">Contact Support</Link></Button><div className="flex items-center text-sm"><span className="font-bold mr-2 text-blue-300">Email:</span><span className="text-white">{supportEmail}</span></div></div></AlertDescription>
                        </Alert>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
