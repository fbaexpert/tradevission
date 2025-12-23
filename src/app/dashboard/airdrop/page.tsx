
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, writeBatch, orderBy, where, getDocs, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Gift, PartyPopper, CheckCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Loader from "@/components/shared/loader";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


interface AirdropEvent {
    id: string;
    title: string;
    assetType: "balance" | "cpm_coin";
    claimedCount: number;
    packetCount: number;
    status: 'active' | 'finished';
}

interface UserClaim {
    amount: number;
    assetType: "balance" | "cpm_coin";
    claimedAt: Timestamp;
    airdropTitle: string;
}

interface CpmAirdropRestrictionSettings {
  enabled: boolean;
  minPlanValue: number;
  minTeamSize: number;
}

export default function AirdropPage() {
    const { user, loading: authLoading } = useAuth();
    const { db, loading: firebaseLoading } = useFirebase();
    const [airdropEvents, setAirdropEvents] = useState<AirdropEvent[]>([]);
    const [userClaims, setUserClaims] = useState<Record<string, UserClaim>>({});
    const [loading, setLoading] = useState(true);
    const [isClaiming, setIsClaiming] = useState<string | null>(null);
    const [claimedReward, setClaimedReward] = useState<{ amount: number; assetType: "balance" | "cpm_coin" } | null>(null);
    const { toast } = useToast();
    
    const [restrictionSettings, setRestrictionSettings] = useState<CpmAirdropRestrictionSettings | null>(null);
    const [isEligible, setIsEligible] = useState(false);
    const [eligibilityLoading, setEligibilityLoading] = useState(true);
    const [eligibilityError, setEligibilityError] = useState<string | null>(null);


    useEffect(() => {
        if (!db) return;
        setLoading(true);

        const q = query(collection(db, "airdrops"), where("status", "==", "active"));
        const unsubscribeEvents = onSnapshot(q, (snapshot) => {
            const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AirdropEvent));
            setAirdropEvents(events);
            if (!user) setLoading(false);
        });

        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                setRestrictionSettings(doc.data().cpmAirdropRestriction);
            }
        });
        
        let unsubscribeClaims: () => void = () => {};
        if (user) {
            const claimsRef = collection(db, "users", user.uid, "airdrop_claims");
            unsubscribeClaims = onSnapshot(query(claimsRef, orderBy("claimedAt", "desc")), (snapshot) => {
                const claims: Record<string, UserClaim> = {};
                snapshot.forEach(doc => {
                    claims[doc.id] = doc.data() as UserClaim;
                });
                setUserClaims(claims);
            });
        }

        return () => { unsubscribeEvents(); unsubscribeClaims(); unsubscribeSettings(); };
    }, [db, user]);

    useEffect(() => {
        if (!user || !db || restrictionSettings === null) {
            if(!authLoading && !firebaseLoading) {
                setEligibilityLoading(false);
                if (restrictionSettings && restrictionSettings.enabled) {
                   setIsEligible(false);
                } else {
                    setIsEligible(true);
                }
            }
            return;
        };

        if (!restrictionSettings.enabled) {
            setIsEligible(true);
            setEligibilityLoading(false);
            setEligibilityError(null);
            return;
        }

        const checkEligibility = async () => {
            setEligibilityLoading(true);
            setEligibilityError(null);

            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const teamSize = userDoc.data()?.totalTeamMembers || 0;
                if (teamSize >= restrictionSettings.minTeamSize) {
                    setIsEligible(true);
                    setEligibilityLoading(false);
                    return;
                }
            }

            const plansQuery = query(collection(db, "userPlans"), where("userId", "==", user.uid), where("status", "==", "active"));
            const plansSnapshot = await getDocs(plansQuery);
            const hasEligiblePlan = plansSnapshot.docs.some(doc => doc.data().planAmount >= restrictionSettings.minPlanValue);

            if (hasEligiblePlan) {
                setIsEligible(true);
            } else {
                setIsEligible(false);
                setEligibilityError(`You must have an active plan of at least $${restrictionSettings.minPlanValue} or a team of at least ${restrictionSettings.minTeamSize} members.`);
            }
            setEligibilityLoading(false);
        };

        checkEligibility();

    }, [user, db, restrictionSettings, authLoading, firebaseLoading]);

    const handleClaim = async (event: AirdropEvent) => {
        if (!user || !db || isClaiming || !isEligible) return;
        setIsClaiming(event.id);
        setClaimedReward(null);

        try {
            const finalReward = await runTransaction(db, async (transaction) => {
                const airdropRef = doc(db, "airdrops", event.id);
                const airdropDoc = await transaction.get(airdropRef);

                if (!airdropDoc.exists()) {
                    throw new Error("This airdrop event no longer exists.");
                }
                const airdropData = airdropDoc.data();
                if (airdropData.status !== 'active') {
                    throw new Error("This airdrop event has already finished.");
                }
                if (airdropData.claims && airdropData.claims[user.uid]) {
                    throw new Error("You have already claimed this airdrop.");
                }

                const remainingAmount = airdropData.totalAmount - airdropData.claimedAmount;
                const remainingPackets = airdropData.packetCount - airdropData.claimedCount;
                
                let rewardAmount = 0;
                if (remainingPackets > 1) {
                    const avg = remainingAmount / remainingPackets;
                    rewardAmount = Math.random() * avg * 1.8 + avg * 0.1;
                } else {
                    rewardAmount = remainingAmount; 
                }
                
                rewardAmount = Math.min(remainingAmount, rewardAmount);
                rewardAmount = Math.floor(rewardAmount * 100) / 100;
                
                if (rewardAmount <= 0 && remainingAmount > 0) {
                    rewardAmount = remainingAmount;
                }
                
                if (rewardAmount <= 0) {
                     throw new Error("The airdrop pool is empty.");
                }

                if (airdropData.assetType === 'balance') {
                    const userRef = doc(db, "users", user.uid);
                    transaction.update(userRef, { balance0: (await transaction.get(userRef)).data()?.balance0 + rewardAmount });
                } else {
                    const coinRef = doc(db, "cpm_coins", user.uid);
                    const coinDoc = await transaction.get(coinRef);
                    const currentCoins = coinDoc.exists() ? coinDoc.data().amount : 0;
                    transaction.set(coinRef, { amount: currentCoins + rewardAmount, userId: user.uid }, { merge: true });
                }

                const newClaimedCount = airdropData.claimedCount + 1;
                const newClaimedAmount = airdropData.claimedAmount + rewardAmount;
                const newStatus = newClaimedCount >= airdropData.packetCount ? 'finished' : 'active';
                
                transaction.update(airdropRef, {
                    claimedCount: newClaimedCount,
                    claimedAmount: newClaimedAmount,
                    status: newStatus,
                    [`claims.${user.uid}`]: rewardAmount
                });

                return { amount: rewardAmount, assetType: airdropData.assetType };
            });

            if (finalReward) {
                const batch = writeBatch(db);
                const claimRef = doc(collection(db, "users", user.uid, "airdrop_claims"), event.id);
                batch.set(claimRef, {
                    amount: finalReward.amount,
                    assetType: finalReward.assetType,
                    claimedAt: serverTimestamp(),
                    airdropTitle: event.title,
                });
                
                const assetLabel = finalReward.assetType === 'balance' ? `$${finalReward.amount.toFixed(2)}` : `${finalReward.amount} CPM`;
                const notifRef = doc(collection(db, "users", user.uid, "notifications"));
                batch.set(notifRef, {
                    userId: user.uid,
                    type: 'success',
                    title: '🎁 Airdrop Claimed!',
                    message: `You received ${assetLabel} from the "${event.title}" airdrop!`,
                    status: 'unread', seen: false, createdAt: serverTimestamp(),
                });
                await batch.commit();

                setClaimedReward(finalReward);
                toast({ title: "Success!", description: `You claimed ${assetLabel}!` });
            }

        } catch (error: any) {
            toast({ variant: "destructive", title: "Claim Failed", description: error.message });
        } finally {
            setIsClaiming(null);
        }
    };
    
    if (authLoading || firebaseLoading || loading || eligibilityLoading) {
        return <Loader />;
    }

    const hasClaimed = (eventId: string) => !!userClaims[eventId];

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-4xl space-y-8">
                 <Card className="border-border/20 shadow-lg shadow-primary/5 bg-transparent text-center">
                    <CardHeader>
                        <Gift className="h-10 w-10 text-accent mx-auto" />
                        <CardTitle className="text-3xl text-white font-bold font-headline">Airdrop Center</CardTitle>
                        <CardDescription className="text-white/80">
                            Participate in special events and claim your "Red Packet" rewards here.
                        </CardDescription>
                    </CardHeader>
                </Card>

                {!isEligible && eligibilityError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Not Eligible for Airdrops</AlertTitle>
                        <AlertDescription>
                           {eligibilityError}
                        </AlertDescription>
                    </Alert>
                )}

                {airdropEvents.length === 0 ? (
                    <div className="text-center p-10 bg-muted/20 rounded-lg border-dashed border-border/40">
                         <p className="text-white font-bold">No Active Airdrops</p>
                         <p className="text-center text-muted-foreground mt-2">There are no airdrop events running at the moment. Check back later!</p>
                    </div>
                ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                        {airdropEvents.map(event => {
                            const isClaimed = hasClaimed(event.id);
                            const isDisabled = !isEligible || isClaimed || event.status === 'finished' || !!isClaiming;
                            return (
                                <Card key={event.id} className={cn(
                                    "border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20 flex flex-col",
                                    (isClaimed || event.status === 'finished' || !isEligible) && "opacity-60"
                                )}>
                                    <CardHeader>
                                        <CardTitle className="text-xl text-white font-bold">{event.title}</CardTitle>
                                        <CardDescription>
                                            {event.packetCount - event.claimedCount} / {event.packetCount} packets remaining
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="flex-grow flex flex-col items-center justify-center text-center">
                                        {claimedReward && isClaiming === event.id ? (
                                            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95">
                                                <PartyPopper className="h-16 w-16 text-yellow-400" />
                                                <p className="text-sm text-muted-foreground">You received:</p>
                                                <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                                                    {claimedReward.assetType === 'balance' ? `$${claimedReward.amount.toFixed(2)}` : `${claimedReward.amount} CPM`}
                                                </p>
                                            </div>
                                        ) : (
                                           <div className="p-8">
                                                <Gift className="h-16 w-16 text-primary"/>
                                           </div>
                                        )}
                                    </CardContent>
                                    <CardFooter>
                                        {isClaimed ? (
                                             <Button disabled className="w-full"><CheckCircle className="mr-2"/> Already Claimed</Button>
                                        ) : event.status === 'finished' ? (
                                             <Button disabled variant="destructive" className="w-full">Airdrop Finished</Button>
                                        ) : (
                                            <Button onClick={() => handleClaim(event)} disabled={isDisabled} className="w-full">
                                                {isClaiming === event.id ? <LoaderCircle className="animate-spin" /> : "Claim Now"}
                                            </Button>
                                        )}
                                    </CardFooter>
                                </Card>
                            )
                        })}
                    </div>
                )}
                
                 {Object.keys(userClaims).length > 0 && (
                    <Card className="border-border/20 shadow-lg shadow-primary/5">
                        <CardHeader>
                            <CardTitle>Your Claim History</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <div className="overflow-x-auto">
                                <ul className="space-y-2">
                                {Object.entries(userClaims).map(([id, claim]) => (
                                    <li key={id} className="flex justify-between items-center p-3 bg-muted/20 rounded-md">
                                        <div>
                                            <p className="font-semibold text-white">{claim.airdropTitle}</p>
                                            <p className="text-sm text-muted-foreground">{claim.claimedAt?.toDate().toLocaleString()}</p>
                                        </div>
                                        <Badge>
                                            + {claim.assetType === 'balance' ? `$${claim.amount.toFixed(2)}` : `${claim.amount} CPM`}
                                        </Badge>
                                    </li>
                                ))}
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                )}

            </div>
        </div>
    );
}
