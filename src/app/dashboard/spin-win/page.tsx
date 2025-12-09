
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, getDoc, collection, query, where, getDocs, runTransaction, serverTimestamp, writeBatch, increment, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoaderCircle, Star, AlertCircle, Info } from "lucide-react";
import Loader from "@/components/shared/loader";
import { SpinWheel } from "@/components/shared/spin-wheel";
import { useToast } from "@/hooks/use-toast";

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
                // Optionally refresh the page or state
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

    useEffect(() => {
        if (!db) return;
        
        const settingsRef = doc(db, "system", "spinWinSettings");
        getDoc(settingsRef).then(doc => {
            if (doc.exists()) {
                setSettings(doc.data() as SpinWinSettings);
            }
        });
    }, [db]);

    useEffect(() => {
        if (!user || !db) {
            setLoadingData(false);
            return;
        }

        const checkData = async () => {
            setLoadingData(true);
            const userRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const data = userDoc.data() as UserData;
                setUserData(data);

                if (data.lastSpinTimestamp) {
                    const nextAvailableTime = new Date(data.lastSpinTimestamp.toMillis() + 24 * 60 * 60 * 1000);
                    if (new Date() < nextAvailableTime) {
                        setCanSpin(false);
                        setNextSpinTime(nextAvailableTime);
                    } else {
                        setCanSpin(true);
                        setNextSpinTime(null);
                    }
                } else {
                    setCanSpin(true);
                }
            }
            
            const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
            const plansSnapshot = await getDocs(plansQuery);
            setHasActivePlan(!plansSnapshot.empty);
            
            setLoadingData(false);
        };
        checkData();
    }, [user, db, spinning]);

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
                
                // Server-side validation
                const { lastSpinTimestamp } = userDoc.data() as UserData;
                if (lastSpinTimestamp) {
                    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
                    if (lastSpinTimestamp.toMillis() > twentyFourHoursAgo) {
                        throw new Error("You can only spin once every 24 hours.");
                    }
                }
                
                // Choose reward based on probability
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

                if (!winningReward) { // Fallback in case of rounding errors
                    winningReward = rewards[rewards.length - 1];
                    winningIndex = rewards.length -1;
                }
                
                const anglePerSegment = 360 / rewards.length;
                const newFinalAngle = (finalAngle + 360 * 5) - (winningIndex * anglePerSegment + anglePerSegment / 2);
                setFinalAngle(newFinalAngle);

                // Apply reward
                if (winningReward.type === "CASH") {
                    transaction.update(userRef, { balance0: increment(winningReward.value) });
                }
                
                // Update user's last spin time
                transaction.update(userRef, { lastSpinTimestamp: serverTimestamp() });
                
                return { reward: winningReward, finalAngle: newFinalAngle };
            });
            
            if (result) {
                // Wait for spin animation to finish
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
                }, 4000); // Should match animation duration
            }

        } catch (err: any) {
            setError(err.message);
            setSpinning(false);
            setIsWheelSpinning(false);
        }
    };
    
    const isEligible = hasActivePlan && userData?.depositDone;
    const isLoading = authLoading || firebaseLoading || loadingData || !settings;
    
    if (isLoading) return <Loader />;
    
    const rewards = settings.rewards.map(r => r.label);

    return (
        <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh_-_var(--header-height))]">
            <Card className="max-w-2xl w-full border-border/20 shadow-lg shadow-primary/5">
                <CardHeader className="text-center">
                    <Star className="mx-auto h-12 w-12 text-yellow-400" />
                    <CardTitle className="text-3xl font-bold text-white font-headline">Spin & Win</CardTitle>
                    <CardDescription>Try your luck once a day to win exciting rewards!</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-8">
                    {!isEligible ? (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Not Eligible</AlertTitle>
                            <AlertDescription>
                                You must have at least one active investment plan and have made your first deposit to play Spin & Win.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <SpinWheel
                                segments={rewards}
                                finalAngle={finalAngle}
                                isSpinning={isWheelSpinning}
                            />

                            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
                            
                            {canSpin ? (
                                <Button onClick={handleSpin} disabled={spinning} size="lg" className="font-bold text-lg">
                                    {spinning ? <LoaderCircle className="animate-spin" /> : "Spin Now!"}
                                </Button>
                            ) : (
                                <div className="text-center p-4 rounded-lg bg-muted/50 border border-border/20">
                                    <p className="text-muted-foreground">Next spin available in:</p>
                                    {nextSpinTime && <CountdownTimer targetDate={nextSpinTime} />}
                                </div>
                            )}
                            
                             <Alert>
                                <Info className="h-4 w-4" />
                                <AlertTitle>Rules & Eligibility</AlertTitle>
                                <AlertDescription>
                                    <ul className="list-disc list-inside space-y-1 mt-2">
                                        <li>You get one free spin every 24 hours.</li>
                                        <li>You must have an active investment plan.</li>
                                        <li>You must have made at least one successful deposit.</li>
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
