
"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/lib/firebase/provider';
import { doc, getDoc, updateDoc, increment, Timestamp, collection, addDoc, serverTimestamp, writeBatch, runTransaction } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Tv, AlertCircle, LoaderCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import Loader from '@/components/shared/loader';

const AD_DURATION = 30; // seconds

export default function AdPage() {
  const { user, loading: authLoading } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userPlanId = searchParams.get('userPlanId');
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [adFinished, setAdFinished] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  // This effect validates if the user is eligible to watch the ad.
  useEffect(() => {
    if (authLoading || firebaseLoading) return;
    if (!user) {
      router.push('/');
      return;
    }
    if (!userPlanId) {
      setError("No plan specified. Please go back to the dashboard and try again.");
      setLoading(false);
      return;
    }
    if (!db) {
        setError("Database connection not available.");
        setLoading(false);
        return;
    }

    const checkAdEligibility = async () => {
        const userPlanDocRef = doc(db, 'userPlans', userPlanId);
        const userPlanDoc = await getDoc(userPlanDocRef);

        if (userPlanDoc.exists()) {
            const planData = userPlanDoc.data();
            if (planData.userId !== user.uid) {
                setError("This plan does not belong to you.");
            } else if (planData.status === 'expired') {
                 setError("This plan has already expired.");
            } else if (planData.lastClaimTimestamp) {
                // The 24-hour check logic
                const lastClaimTime = planData.lastClaimTimestamp.toDate();
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
                if (lastClaimTime > twentyFourHoursAgo) {
                    setError("You can only claim the reward for this plan once every 24 hours.");
                }
            }
        } else {
             setError("The specified plan was not found.");
        }
         setLoading(false);
    }
    checkAdEligibility();
  }, [user, authLoading, router, userPlanId, db, firebaseLoading]);

  // This effect runs the ad timer.
  useEffect(() => {
    if (error || loading || adFinished) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setAdFinished(true);
          return 100;
        }
        return prev + 100 / AD_DURATION;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [error, loading, adFinished]);

  // This function handles the reward claim transaction.
  const handleClaimReward = async () => {
    if (!user || !adFinished || !userPlanId || isClaiming || !db) return;

    setIsClaiming(true);
    setError(null);

    try {
        const { finalReward, teamBonus } = await runTransaction(db, async (transaction) => {
            const userPlanDocRef = doc(db, "userPlans", userPlanId);
            const userDocRef = doc(db, "users", user.uid);
            
            const userPlanDoc = await transaction.get(userPlanDocRef);
            const currentUserDoc = await transaction.get(userDocRef);
            
            if (!userPlanDoc.exists()) throw new Error("User plan data not found.");
            if (!currentUserDoc.exists()) throw new Error("Your user data could not be found.");
            
            const planData = userPlanDoc.data();
            const currentUserData = currentUserDoc.data();
            const dailyReward = planData.dailyReward || 0;

            if (planData.status === 'expired') throw new Error("This plan has expired.");
            if (planData.lastClaimTimestamp) {
                const lastClaimTime = planData.lastClaimTimestamp.toDate();
                if (Date.now() - lastClaimTime.getTime() < 24 * 60 * 60 * 1000) {
                    throw new Error("Reward can only be claimed once every 24 hours.");
                }
            }
            if (dailyReward <= 0) throw new Error("No valid daily reward amount for this plan.");

            // This counter is not used for daysLeft calculation but for ad watching record
            transaction.update(userPlanDocRef, {
                daysCompleted: increment(1),
                lastClaimTimestamp: serverTimestamp(),
            });
            transaction.update(userDocRef, { balance0: increment(dailyReward) });
            
            let calculatedTeamBonus = 0;
            if (currentUserData && currentUserData.referredBy) {
                const referrerDocRef = doc(db, "users", currentUserData.referredBy);
                const referrerDoc = await transaction.get(referrerDocRef);
                if (referrerDoc.exists() && !referrerDoc.data()!.teamBonusPaused) {
                    calculatedTeamBonus = dailyReward * 0.10; // 10% daily team bonus
                    transaction.update(referrerDocRef, {
                        balance0: increment(calculatedTeamBonus),
                        totalTeamBonus: increment(calculatedTeamBonus)
                    });
                }
            }
            return { finalReward: dailyReward, teamBonus: calculatedTeamBonus };
        });

        // --- Post-transaction updates (Notifications and Logs) ---
        const planDoc = await getDoc(doc(db, "userPlans", userPlanId));
        if (!planDoc.exists()) throw new Error("Could not retrieve plan data after transaction.");
        
        const batch = writeBatch(db);
        
        batch.set(doc(collection(db, "users", user.uid, "notifications")), {
            userId: user.uid, type: 'profit', title: '💰 Daily Profit Added',
            message: `You earned $${finalReward.toFixed(2)} from your plan: ${planDoc.data().planName}.`,
            amount: finalReward, status: 'unread', seen: false, createdAt: serverTimestamp(), relatedId: userPlanId
        });
        
        batch.set(doc(collection(db, "activityLogs")), {
            userId: user.uid, action: 'daily_profit_claim',
            details: `Claimed $${finalReward.toFixed(2)} from plan ${planDoc.data().planName} (${userPlanId})`,
            timestamp: serverTimestamp(), relatedId: userPlanId
        });

        const currentUserDoc = await getDoc(doc(db, "users", user.uid));
        const currentUserData = currentUserDoc.data();
        if (currentUserData?.referredBy && teamBonus > 0) {
            batch.set(doc(collection(db, "users", currentUserData.referredBy, "notifications")), {
                userId: currentUserData.referredBy, type: 'success', title: '💸 Team Bonus!',
                message: `You earned a $${teamBonus.toFixed(2)} bonus from your team member ${currentUserData.name || 'friend'}'s daily task.`,
                amount: teamBonus, status: 'unread', seen: false, createdAt: serverTimestamp(), relatedId: user.uid,
            });
        }
        
        await batch.commit();

        toast({
            title: "Reward Claimed!",
            description: `You've earned $${finalReward.toFixed(2)}.`,
            className: "bg-green-500 text-white"
        });
        router.push('/dashboard');

    } catch (err: any) {
      setError(err.message || "Failed to claim reward.");
      toast({
          variant: "destructive",
          title: "Claim Failed",
          description: err.message || "Could not claim your reward."
      })
    } finally {
        setIsClaiming(false);
    }
  };

  if (authLoading || loading || firebaseLoading) {
    return <Loader />;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh_-_var(--header-height))]">
      <div className="container mx-auto max-w-md">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex flex-col items-center gap-4 text-center">
              <Tv className="h-10 w-10 text-accent" />
              <CardTitle className="text-2xl font-headline text-white font-bold">
                Claim Daily Reward
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
                 <Button onClick={() => router.push('/dashboard')} className="mt-4 w-full">Go to Dashboard</Button>
              </Alert>
            ) : (
              <>
                <p className="text-foreground mb-6">
                  Watch the ad for {AD_DURATION} seconds to claim your daily reward for this plan.
                </p>
                <div className="w-full bg-muted/20 rounded-lg overflow-hidden h-40 flex items-center justify-center text-foreground mb-6">
                  Ad Placeholder
                </div>
                <Progress value={progress} className="mb-4" />

                {adFinished ? (
                    <Button onClick={handleClaimReward} disabled={isClaiming} className="w-full">
                        {isClaiming ? <LoaderCircle className="animate-spin"/> : <><CheckCircle /><span>Claim Reward</span></>}
                    </Button>
                ) : (
                    <p className="text-sm text-accent font-medium">
                        {Math.max(0, Math.ceil(AD_DURATION - (progress * AD_DURATION) / 100))}s remaining...
                    </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
