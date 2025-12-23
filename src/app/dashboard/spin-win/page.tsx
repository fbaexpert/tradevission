"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, writeBatch, increment, Timestamp, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoaderCircle, Star, AlertCircle, Info, ShieldAlert } from "lucide-react";
import Loader from "@/components/shared/loader";
import { SpinWheel } from "@/components/shared/spin-wheel";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";


interface SpinReward {
    label: string;
    value: number;
    type: "CASH" | "TRY_AGAIN";
    probability: number;
}

interface SpinWinSettings {
    rewards: SpinReward[];
}

interface UserData {
    depositDone?: boolean;
    lastSpinTimestamp?: Timestamp;
    totalTeamMembers?: number;
}

interface FeatureEligibility {
  enabled: boolean;
  minPlanValue: number;
  minTeamSize: number;
}

const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();

            if (difference > 0) {
                const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
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

export default function SpinWinPage() {
    const { user, loading: authLoading } = useAuth();
    const { db, loading: firebaseLoading } = useFirebase();
    const { toast } = useToast();

    const [settings, setSettings] = useState<SpinWinSettings | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [hasActivePlan, setHasActivePlan] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const [spinning, setSpinning] = useState(false);
    const [canSpin, setCanSpin] = useState(false);
    const [nextSpinTime, setNextSpinTime] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [finalAngle, setFinalAngle] = useState(0);
    const [isWheelSpinning, setIsWheelSpinning] = useState(false);

    const [eligibilitySettings, setEligibilitySettings] = useState<FeatureEligibility | null>(null);
    const [isEligible, setIsEligible] = useState(false);
    const [eligibilityLoading, setEligibilityLoading] = useState(true);
    const [eligibilityError, setEligibilityError] = useState<string | null>(null);

    useEffect(() => {
        if (!db) return;
        
        const settingsRef = doc(db, "system", "settings");
        const unsubSettings = onSnapshot(settingsRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setSettings(data.spinWinSettings || null);
                setEligibilitySettings(data.featureEligibility || null);
            }
        });
        
        return () => unsubSettings();

    }, [db]);

    useEffect(() => {
        if (!user || !db) {
            setLoadingData(false);
            setEligibilityLoading(false);
            return;
        }

        const checkEligibilityAndData = async () => {
            setLoadingData(true);
            setEligibilityLoading(true);

            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
                const data = userDoc.data() as UserData;
                setUserData(data);

                if (data.lastSpinTimestamp) {
                    const nextAvailableTime = new Date(data.lastSpinTimestamp.toMillis() + 24 * 60 * 60 * 1000);
                    setCanSpin(new Date() >= nextAvailableTime);
                    setNextSpinTime(new Date() < nextAvailableTime ? nextAvailableTime : null);
                } else {
                    setCanSpin(true);
                }
                
                // Eligibility Check
                if (eligibilitySettings && eligibilitySettings.enabled) {
                    const teamSize = data.totalTeamMembers || 0;
                    if (teamSize >= eligibilitySettings.minTeamSize) {
                        setIsEligible(true);
                        setEligibilityError(null);
                    } else {
                        const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
                        const plansSnapshot = await getDocs(plansQuery);
                        const hasEligiblePlan = plansSnapshot.docs.some(doc => doc.data().planAmount >= eligibilitySettings.minPlanValue);
                        
                        if (hasEligiblePlan) {
                            setIsEligible(true);
                            setEligibilityError(null);
                        } else {
                            setIsEligible(false);
                            setEligibilityError(`You must have an active plan of at least $${eligibilitySettings.minPlanValue} or a team of at least ${eligibilitySettings.minTeamSize} members.`);
                        }
                    }
                } else {
                    setIsEligible(true); // If restrictions are off, everyone is eligible
                    setEligibilityError(null);
                }
            }
            
            const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
            const plansSnapshot = await getDocs(plansQuery);
            setHasActivePlan(!plansSnapshot.empty);
            
            setLoadingData(false);
            setEligibilityLoading(false);
        };
        
        // We run this check only when eligibilitySettings is loaded
        if (eligibilitySettings !== null) {
            checkEligibilityAndData();
        }

    }, [user, db, spinning, eligibilitySettings]);

    const handleSpin = async () => {
        if (!user || !db || !settings || spinning) return;

        setSpinning(true);
        setError(null);
        setIsWheelSpinning(true);

        try {
            const result = await runTransaction(db, async (transaction) => {
                const userRef = doc(db, "users", user.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) throw new Error("User not found.");
                
                const { lastSpinTimestamp } = userDoc.data() as UserData;
                if (lastSpinTimestamp) {
                    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
                    if (lastSpinTimestamp.toMillis() > twentyFourHoursAgo) {
                        throw new Error("You can only spin once every 24 hours.");
                    }
                }
                
                const rewards = settings.rewards;
                const totalProbability = rewards.reduce((acc, reward) => acc + (reward.probability || 0), 0);
                let randomPoint = Math.random() * totalProbability;
                
                let winningReward: SpinReward | null = null;
                let winningIndex = -1;

                for(let i = 0; i < rewards.length; i++) {
                    const reward = rewards[i];
                    if(randomPoint < (reward.probability || 0)) {
                        winningReward = reward;
                        winningIndex = i;
                        break;
                    }
                    randomPoint -= (reward.probability || 0);
                }

                if (!winningReward) {
                    winningReward = rewards[rewards.length - 1];
                    winningIndex = rewards.length -1;
                }
                
                const anglePerSegment = 360 / rewards.length;
                const newFinalAngle = (finalAngle + 360 * 5) - (winningIndex * anglePerSegment + anglePerSegment / 2);
                setFinalAngle(newFinalAngle);

                if (winningReward.type === "CASH") {
                    transaction.update(userRef, { balance0: increment(winningReward.value) });
                }
                
                transaction.update(userRef, { lastSpinTimestamp: serverTimestamp() });
                
                return { reward: winningReward, finalAngle: newFinalAngle };
            });
            
            if (result) {
                setTimeout(() => {
                    if (result.reward.type !== "TRY_AGAIN") {
                         toast({
                            title: "Congratulations!",
                            description: `You won: ${result.reward.label}`,
                            className: "bg-green-500 text-white"
                        });
                    } else {
                         toast({
                            title: "Better luck next time!",
                            description: "You didn't win a prize this time. Try again tomorrow.",
                        });
                    }
                    setIsWheelSpinning(false);
                    setSpinning(false);
                }, 4000);
            }

        } catch (err: any) {
            setError(err.message);
            setSpinning(false);
            setIsWheelSpinning(false);
        }
    };
    
    const isLoading = authLoading || firebaseLoading || loadingData || eligibilityLoading || !settings;
    
    if (isLoading) return <Loader />;
    
    const rewards = settings.rewards.map(r => r.label);

    const isSpinDisabled = !isEligible || spinning || !canSpin;

    return (
        <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh_-_var(--header-height))]">
            <Card className="max-w-2xl w-full border-border/20 shadow-lg shadow-primary/5">
                <CardHeader className="text-center">
                    <Star className="mx-auto h-12 w-12 text-yellow-400" />
                    <CardTitle className="text-3xl font-bold text-white font-headline">Spin &amp; Win</CardTitle>
                    <CardDescription>Try your luck once a day to win exciting rewards!</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-8">
                    {!isEligible && eligibilityError ? (
                         <div className="relative p-6 rounded-lg border bg-gradient-to-br from-red-900/40 via-background to-background overflow-hidden w-full">
                            <div 
                                className="absolute inset-0 opacity-10"
                                style={{
                                    backgroundImage: `radial-gradient(circle at 10% 20%, hsl(var(--destructive)), transparent 70%), radial-gradient(circle at 90% 80%, hsl(var(--destructive)), transparent 70%)`
                                }}
                            />
                            <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                                <div className="p-3 rounded-full bg-red-500/20 border border-red-500/30">
                                    <ShieldAlert className="h-10 w-10 text-red-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white">Not Eligible</h3>
                                    <p className="text-sm text-red-200/80 mt-1">{eligibilityError}</p>
                                    <Button asChild size="sm" variant="outline" className="mt-4 bg-transparent hover:bg-white/10 text-white">
                                        <Link href="/dashboard/plans">View Plans</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <SpinWheel
                                segments={rewards}
                                finalAngle={finalAngle}
                                isSpinning={isWheelSpinning}
                            />

                            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                            
                            {!canSpin && nextSpinTime ? (
                                 <div className="text-center p-4 rounded-lg bg-muted/50 border border-border/20">
                                    <p className="text-muted-foreground">Next spin available in:</p>
                                    <CountdownTimer targetDate={nextSpinTime} />
                                </div>
                            ) : (
                                <Button onClick={handleSpin} disabled={isSpinDisabled} size="lg" className="font-bold text-lg">
                                    {spinning ? <LoaderCircle className="animate-spin" /> : "Spin Now!"}
                                </Button>
                            )}
                            
                             <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Rules &amp; Eligibility</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside space-y-1 mt-2">
                                        <li>You get one free spin every 24 hours.</li>
                                        {eligibilitySettings?.enabled ? (
                                            <li>You must meet the minimum team or plan requirements.</li>
                                        ) : (
                                            <li>You must have at least one active investment plan and have made a deposit.</li>
                                        )}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
