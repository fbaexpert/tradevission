
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, collection, query, where, Timestamp, onSnapshot, orderBy, deleteDoc, writeBatch } from "firebase/firestore";
import Link from "next/link";
import Loader from "@/components/shared/loader";
import { User, Mail, Calendar, AlertCircle, DollarSign, Tv, ArrowUpFromDot, Zap, CalendarDays, Rocket, Copy, Users2, ShieldCheck, Coins, Clock, Briefcase, UsersRound, Star, Trophy } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SimulatedActivityFeed from "@/components/shared/activity-feed";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { VipTier } from "@/app/admin/vip-tiers/page";
import { httpsCallable } from "firebase/functions";


// --- Data Interfaces ---
interface CustomBadge {
    id: string;
    name: string;
    color: string;
}

interface UserData {
  uid: string;
  name: string;
  email: string;
  createdAt: { seconds: number; nanoseconds: number; } | null;
  balance0?: number;
  totalWithdrawn?: number;
  totalReferralBonus?: number;
  totalTeamBonus?: number;
  isCommander?: boolean;
  customBadges?: CustomBadge[];
  totalDeposit?: number; // Added for VIP progress
}

interface UserPlan {
    id: string;
    planName: string;
    planAmount: number;
    dailyReward: number;
    durationDays: number;
    startDate: Timestamp;
    lastClaimTimestamp?: Timestamp;
    status: 'active' | 'expired';
}

interface Transaction {
  id: string;
  type?: 'deposit' | 'withdrawal';
  method?: 'crypto' | 'iban' | 'bank';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Timestamp;
  [key: string]: any;
}

interface CpmCoinData {
    amount: number;
}

// --- PlanCard Component ---
const PlanCard = ({ plan }: { plan: UserPlan }) => {
    const [timeLeft, setTimeLeft] = useState<string | null>(null);
    const [canWatchAd, setCanWatchAd] = useState(false);

    const { daysCompleted, daysLeft, progressValue } = useMemo(() => {
        if (!plan.startDate) {
            return { daysCompleted: 0, daysLeft: plan.durationDays, progressValue: 0 };
        }
        const now = new Date();
        const start = plan.startDate.toDate();
        const timeDiff = now.getTime() - start.getTime();
        const completed = Math.floor(timeDiff / (1000 * 3600 * 24));
        const duration = plan.durationDays || 1;

        const actualDaysCompleted = Math.max(0, Math.min(completed, duration));
        const actualDaysLeft = Math.max(0, duration - actualDaysCompleted);
        const progress = duration > 0 ? (actualDaysCompleted / duration) * 100 : 0;
        
        return {
            daysCompleted: actualDaysCompleted,
            daysLeft: actualDaysLeft,
            progressValue: progress
        };
    }, [plan.startDate, plan.durationDays]);
    
    useEffect(() => {
        if (!plan) return;
        const calculateTimeLeft = () => {
            if (plan.lastClaimTimestamp) {
                const now = new Date().getTime();
                const nextClaimTime = plan.lastClaimTimestamp.toMillis() + 24 * 60 * 60 * 1000;
                
                if (now < nextClaimTime) {
                    setCanWatchAd(false);
                    const remainingTime = nextClaimTime - now;
                    const hours = Math.floor((remainingTime / (1000 * 60 * 60)) % 24);
                    const minutes = Math.floor((remainingTime / 1000 / 60) % 60);
                    const seconds = Math.floor((remainingTime / 1000) % 60);
                    setTimeLeft(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
                } else {
                    setCanWatchAd(true);
                    setTimeLeft(null);
                }
            } else {
                setCanWatchAd(true);
                setTimeLeft(null);
            }
        };

        const timerInterval = setInterval(calculateTimeLeft, 1000);
        calculateTimeLeft();

        return () => clearInterval(timerInterval);

    }, [plan]);


    return (
        <div className="group relative rounded-xl border border-border/30 bg-gradient-to-br from-card to-muted/20 p-4 sm:p-6 shadow-lg transition-all duration-300 hover:shadow-primary/20 hover:border-primary/50 hover:-translate-y-1">
          <CardHeader className="p-0 mb-4">
              <div className="flex justify-between items-center">
                  <CardTitle className="text-lg sm:text-xl text-white font-bold flex items-center gap-2">
                     <Rocket /> {plan.planName}
                  </CardTitle>
                  <Badge className="bg-purple-600/80 text-white border-purple-400"><ShieldCheck className="h-3 w-3 mr-1"/> ${plan.planAmount} Plan</Badge>
              </div>
          </CardHeader>
          <CardContent className="p-0 flex-grow grid gap-4">
               <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-accent" />
                      <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Daily Reward</p>
                          <p className="font-bold text-base sm:text-lg text-white">${plan.dailyReward.toFixed(2)}</p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-accent" />
                      <div>
                          <p className="text-xs sm:text-sm text-muted-foreground">Days Left</p>
                          <p className="font-bold text-base sm:text-lg text-white">{daysLeft}</p>
                      </div>
                  </div>
              </div>
               <div>
                  <div className="flex justify-between items-center mb-1 text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{plan.durationDays} days total</span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
              </div>
          </CardContent>
          <CardFooter className="p-0 mt-6">
              <Button asChild disabled={!canWatchAd} className="w-full">
                  <Link href={`/dashboard/ad?userPlanId=${plan.id}`}>
                      <Tv className="mr-2 h-4 w-4" /> 
                      {canWatchAd 
                          ? "Watch Ad & Earn" 
                          : (
                              <div className="flex items-center gap-2 text-xs sm:text-sm">
                                  <Clock className="h-4 w-4" />
                                  <span>Next ad in: {timeLeft}</span>
                              </div>
                          )
                      }
                  </Link>
              </Button>
          </CardFooter>
      </div>
    );
}

// --- VIP Progress Card Component ---
const VipProgressCard = ({ tiers, totalDeposit }: { tiers: VipTier[], totalDeposit: number }) => {
    const { currentTier, nextTier, progressPercentage, rank } = useMemo(() => {
        let current: VipTier | null = null;
        let next: VipTier | null = null;
        let currentRank = "Member";

        for (let i = 0; i < tiers.length; i++) {
            if (totalDeposit >= tiers[i].minDeposit) {
                current = tiers[i];
                currentRank = tiers[i].name;
            } else {
                if (!next) {
                    next = tiers[i];
                }
            }
        }
        
        let progress = 0;
        const startOfRange = current?.minDeposit ?? 0;
        const endOfRange = next?.minDeposit ?? (current ? current.minDeposit * 2 || startOfRange + 1 : 100);

        if (totalDeposit >= endOfRange) {
            progress = 100;
        } else if (endOfRange > startOfRange) {
            progress = ((totalDeposit - startOfRange) / (endOfRange - startOfRange)) * 100;
        }
        
        return {
            currentTier: current,
            nextTier: next,
            progressPercentage: Math.max(0, Math.min(100, progress)),
            rank: currentRank
        };
    }, [tiers, totalDeposit]);
    
    const glowColor = currentTier?.badgeColor || '#4f46e5';

    return (
        <div className="relative rounded-2xl bg-slate-900/70 border border-slate-700/50 p-6 overflow-hidden backdrop-blur-sm">
             <div 
                className="absolute inset-x-0 top-0 h-40 w-full opacity-30 [mask-image:radial-gradient(ellipse_at_top,transparent_20%,#000)]"
                style={{ background: `linear-gradient(to top, transparent, ${glowColor})` }}
            ></div>
            <div className="grid md:grid-cols-3 gap-6 items-center relative z-10">
                <div className="flex flex-col items-center justify-center">
                     <div className="relative w-36 h-36">
                        <svg className="w-full h-full" viewBox="0 0 100 100">
                            <circle
                                className="text-slate-800"
                                stroke="currentColor"
                                strokeWidth="8"
                                cx="50"
                                cy="50"
                                r="42"
                                fill="transparent"
                            />
                            <circle
                                className="transition-all duration-1000 ease-in-out"
                                stroke={glowColor}
                                strokeWidth="8"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="42"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 42}
                                strokeDashoffset={2 * Math.PI * 42 * (1 - progressPercentage / 100)}
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                            <span className="text-2xl font-bold" style={{ color: glowColor }}>{rank}</span>
                            <span className="text-xs text-slate-400">VIP Rank</span>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-2 space-y-4 text-center md:text-left">
                    {nextTier ? (
                        <>
                            <div>
                                <h3 className="text-lg font-bold text-white">Next Level: <span style={{ color: nextTier.badgeColor }}>{nextTier.name}</span></h3>
                                <p className="text-sm text-slate-400">Deposit <span className="font-bold text-white">${Math.max(0, nextTier.minDeposit - totalDeposit).toFixed(2)}</span> more to unlock a <span className="font-bold text-white">{nextTier.bonusPercentage}% deposit bonus!</span></p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-xs text-slate-400">
                                    <span>${totalDeposit.toFixed(2)}</span>
                                    <span>${nextTier.minDeposit.toLocaleString()}</span>
                                </div>
                                <Progress value={progressPercentage} className="h-2 bg-slate-700" indicatorClassName="bg-gradient-to-r from-primary to-accent" />
                            </div>
                            <Button asChild size="sm" className="mt-2 shadow-lg shadow-primary/20">
                                <Link href="/dashboard/deposit">Deposit Now</Link>
                            </Button>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <Trophy className="mx-auto h-12 w-12 text-yellow-400" />
                            <h3 className="mt-2 text-xl font-bold text-white">You've Reached the Top!</h3>
                            <p className="text-sm text-slate-400">Congratulations on achieving the highest VIP level.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- Main Dashboard Component ---
export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { db, functions, loading: firebaseLoading } = useFirebase();
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cpmCoinData, setCpmCoinData] = useState<CpmCoinData | null>(null);
  const [vipTiers, setVipTiers] = useState<VipTier[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);


  useEffect(() => {
    if (authLoading || firebaseLoading || !user || !db) {
        if (!authLoading && !user) {
            setDataLoading(false);
        }
        return;
    };
    
    setDataLoading(true);
    
    // Set up real-time listeners for all necessary data
    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
        if(doc.exists()) {
            setUserData({ uid: doc.id, ...doc.data() } as UserData);
        } else {
          // This case handles when an admin deletes the user.
          // The auth listener in AuthProvider will eventually log the user out.
          setUserData(null);
        }
    }, (err) => {
        console.error("Error with real-time user data:", err);
        setError("Could not get live updates for your profile.");
    });
    
    const plansQuery = query(
        collection(db, "userPlans"), 
        where("userId", "==", user.uid),
        where("status", "==", "active")
    );
    const unsubscribePlans = onSnapshot(plansQuery, (snapshot) => {
        const plans: UserPlan[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserPlan));
        setUserPlans(plans);
    });

    const cpmCoinDocRef = doc(db, "cpm_coins", user.uid);
    const unsubscribeCpmCoin = onSnapshot(cpmCoinDocRef, (doc) => {
        setCpmCoinData(doc.exists() ? doc.data() as CpmCoinData : null);
    });

    // UPDATED: Simple query, sort in code.
    const vipTiersQuery = query(collection(db, "vipTiers"), where("isEnabled", "==", true));
    const unsubscribeVipTiers = onSnapshot(vipTiersQuery, (snapshot) => {
        const tiersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Omit<VipTier, 'rank'>));
        
        tiersData.sort((a, b) => a.minDeposit - b.minDeposit);
        const rankedTiers = tiersData.map((tier, index) => ({ ...tier, rank: index + 1 }));

        setVipTiers(rankedTiers);
    });


    let deposits: Transaction[] = [];
    let withdrawals: Transaction[] = [];
    
    const updateAllTransactions = () => {
        const allTxs = [...deposits, ...withdrawals].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
        setTransactions(allTxs);
    }
    
    const depositsQuery = query(collection(db, "deposits"), where("uid", "==", user.uid));
    const unsubscribeDeposits = onSnapshot(depositsQuery, (snapshot) => {
        deposits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'deposit' } as Transaction));
        updateAllTransactions();
    });

    const withdrawalsQuery = query(collection(db, "withdrawals"), where("userId", "==", user.uid));
    const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
        withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'withdrawal' } as Transaction));
        updateAllTransactions();
    });

    setDataLoading(false);
    
    return () => {
        unsubscribeUser();
        unsubscribePlans();
        unsubscribeCpmCoin();
        unsubscribeVipTiers();
        unsubscribeDeposits();
        unsubscribeWithdrawals();
    };

  }, [user, authLoading, firebaseLoading, db]);
  
  const sortedTransactions = useMemo(() => {
    return transactions.slice(0, 10);
  }, [transactions]);

  const getInitials = (name: string) => {
    if(!name) return "?";
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }

  const handleDeleteUser = async () => {
    if (!user || !functions) return;
    setIsDeleting(true);

    try {
        const deleteUserAccount = httpsCallable(functions, 'deleteUserAccount');
        const result = await deleteUserAccount({ uid: user.uid });
        toast({
            title: "Account Deletion Successful",
            description: "Your account and all associated data are being removed.",
        });
        // The auth state listener will handle logout and redirection.
    } catch (error: any) {
        console.error("Error deleting account:", error);
        toast({
            variant: "destructive",
            title: "Deletion Failed",
            description: error.message || "Could not delete your account at this time. Please contact support.",
        });
        setIsDeleting(false);
    }
  };

  const isLoading = authLoading || dataLoading;

  if (isLoading || !user || !userData) {
    return <Loader />;
  }

  const createdAtDate = userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : "N/A";
  const balance = userData.balance0 ?? 0;
  const totalWithdrawn = userData.totalWithdrawn ?? 0;
  const totalReferralBonus = userData.totalReferralBonus ?? 0;
  const totalTeamBonus = userData.totalTeamBonus ?? 0;
  const hasCpmCoins = cpmCoinData && cpmCoinData.amount > 0;
  
  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'secondary';
    if (s === 'approved') return 'default';
    if (s === 'rejected') return 'destructive';
    return 'secondary';
  }

  const copyReferralLink = async () => {
    if (!userData) return;
    const link = `https://tradevission.online/?ref=${userData.uid}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "Referral Link Copied!",
        description: "Share it with your friends to build your team.",
      });
    } catch (err) {
      console.error("Failed to copy: ", err);
      toast({
        variant: "destructive",
        title: "Copy Failed",
        description: "Could not copy the link automatically. Please copy it manually.",
      });
    }
  };


  return (
    <>
      <SimulatedActivityFeed />
      <div className="p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-6xl">
            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <Card className="overflow-hidden border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary">
                                <AvatarImage src={user.photoURL || undefined} alt={userData.name || 'User'} />
                                <AvatarFallback className="text-xl sm:text-2xl bg-primary/20 text-primary font-bold">
                                    {getInitials(userData.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                            <CardTitle className="text-2xl sm:text-3xl font-headline text-white font-bold flex items-center gap-2 flex-wrap">
                                {userData.name || "Trader"}
                                 {userData.isCommander &&
                                    <Badge className="bg-gradient-to-br from-yellow-400 to-amber-500 text-black border-yellow-600 text-xs sm:text-sm shadow-lg shadow-amber-500/40">
                                        <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-black"/> Commander
                                    </Badge>
                                 }
                                {hasCpmCoins && !userData.isCommander &&
                                    <Badge className="bg-gradient-to-br from-purple-600 to-indigo-700 text-yellow-300 border-purple-400 text-xs sm:text-sm shadow-lg shadow-purple-500/20">
                                        <ShieldCheck className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-1.5 text-yellow-400"/> VIP
                                    </Badge>
                                }
                                {userData.customBadges?.map(badge => (
                                    <Badge key={badge.id} style={{
                                        '--badge-color': badge.color,
                                        backgroundImage: `linear-gradient(to bottom right, ${badge.color}, #00000040)`,
                                        borderColor: 'rgba(255, 255, 255, 0.2)',
                                        color: 'white',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                                        boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2)'
                                     } as React.CSSProperties} className="border text-xs sm:text-sm">
                                        {badge.name}
                                    </Badge>
                                ))}
                            </CardTitle>
                            <CardDescription className="mt-1 text-white/80 text-sm">
                                {userData.email}
                            </CardDescription>
                            </div>
                        </div>
                        <Button onClick={copyReferralLink} className="w-full sm:w-auto">
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Referral Link
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 grid gap-4">
                    
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                         <div className="flex items-start gap-3 rounded-md border border-border/20 p-4 bg-background/40">
                            <DollarSign className="h-5 w-5 sm:h-6 sm:w-6 text-green-400 flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-xs sm:text-sm text-white/80">Balance</p>
                                <p className="font-bold text-xl sm:text-2xl text-white">${balance.toFixed(2)}</p>
                            </div>
                        </div>
                         <div className="flex items-start gap-3 rounded-md border border-border/20 p-4 bg-background/40">
                            <Coins className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-400 flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-xs sm:text-sm text-white/80">CPM Coins</p>
                                <p className="font-bold text-xl sm:text-2xl text-white">{(cpmCoinData?.amount || 0).toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-md border border-border/20 p-4 bg-background/40">
                            <ArrowUpFromDot className="h-5 w-5 sm:h-6 sm:w-6 text-accent flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-xs sm:text-sm text-white/80">Total Withdraw</p>
                                <p className="font-bold text-xl sm:text-2xl text-white">${totalWithdrawn.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-md border border-border/20 p-4 bg-background/40">
                            <UsersRound className="h-5 w-5 sm:h-6 sm:w-6 text-purple-400 flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-xs sm:text-sm text-white/80">Referral Bonus</p>
                                <p className="font-bold text-xl sm:text-2xl text-white">${totalReferralBonus.toFixed(2)}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 rounded-md border border-border/20 p-4 bg-background/40">
                            <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400 flex-shrink-0 mt-1" />
                            <div>
                                <p className="text-xs sm:text-sm text-white/80">Team Bonus</p>
                                <p className="font-bold text-xl sm:text-2xl text-white">${totalTeamBonus.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                    
                    {vipTiers.length > 0 && <VipProgressCard tiers={vipTiers} totalDeposit={userData.totalDeposit || 0} />}

                    {userPlans.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2">
                            {userPlans.map(plan => <PlanCard key={plan.id} plan={plan} />)}
                        </div>
                    ) : (
                        <div className="text-center p-6 bg-muted/20 rounded-md border border-border/20">
                            <p className="text-foreground">You don't have an active investment plan.</p>
                            <Button asChild className="mt-4">
                                <Link href="/dashboard/plans">
                                    View Investment Plans
                                </Link>
                            </Button>
                        </div>
                    )}


                    <Card className="border-border/20 shadow-inner mt-4 bg-background/30">
                        <CardHeader><CardTitle className="text-white font-bold">Recent Transactions</CardTitle></CardHeader>
                        <CardContent>
                            {sortedTransactions.length === 0 ? <p className="text-foreground text-center py-4">No transactions yet.</p> : (
                                <div className="overflow-x-auto">
                                <ul className="space-y-4">
                                    {sortedTransactions.map(t => (
                                        <li key={t.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-md">
                                            <div>
                                                <p className={cn("font-semibold capitalize", t.type === 'deposit' ? 'text-green-400' : 'text-red-400')}>{t.type} {t.method && `(${t.method})`}</p>
                                                <p className="text-sm text-white/80">{t.createdAt ? t.createdAt.toDate().toLocaleString() : "N/A"}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg">${t.amount.toFixed(2)}</p>
                                                <Badge variant={getStatusVariant(t.status)} className="capitalize">{t.status.toLowerCase()}</Badge>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                </CardContent>
            </Card>
        </div>
      </div>
    </>
  );
}
