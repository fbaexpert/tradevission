"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, Timestamp, getDoc, increment, collection, onSnapshot, query, where, writeBatch, serverTimestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Rocket, LoaderCircle, AlertCircle, TrendingUp, CalendarDays, Zap, Crown, Percent, Clock, KeyRound, Tag } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import Loader from "@/components/shared/loader";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// --- Data Interfaces ---
interface PlanOffer {
    enabled: boolean;
    discountPercentage: number;
    startTime?: string;
    endTime?: string;
    includeVipCode?: boolean;
}

interface Plan {
  id: string;
  planName: string;
  price: number;
  durationDays: number;
  dailyProfit: number;
  totalProfit: number;
  tag?: string;
  description?: string;
  offer?: PlanOffer;
}

interface PlanTag {
    id: string;
    name: string;
    color: string;
}


// --- Helper Components ---
const OfferCountdown = ({ targetDate, onEnd }: { targetDate: string, onEnd?: () => void }) => {
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
      <div className="flex justify-center gap-2 sm:gap-4">
        {Object.entries(timeLeft).map(([unit, value]) => (
          <div key={unit} className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tighter">{String(value).padStart(2, '0')}</span>
            <span className="text-xs text-muted-foreground capitalize">{unit}</span>
          </div>
        ))}
      </div>
  );
};


// --- Main Plans Page Component ---
export default function PlansPage() {
  const { user, loading: authLoading } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planTags, setPlanTags] = useState<PlanTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  
  const [planOfferStatuses, setPlanOfferStatuses] = useState<Record<string, 'inactive' | 'upcoming' | 'active'>>({});

   useEffect(() => {
    const interval = setInterval(() => {
      setPlanOfferStatuses(prevStatuses => {
        const newStatuses: Record<string, 'inactive' | 'upcoming' | 'active'> = {};
        let changed = false;
        plans.forEach(plan => {
          const offer = plan.offer;
          let newStatus: 'inactive' | 'upcoming' | 'active' = 'inactive';
          if (offer && offer.enabled && offer.startTime && offer.endTime) {
            const now = new Date().getTime();
            const startTime = new Date(offer.startTime).getTime();
            const endTime = new Date(offer.endTime).getTime();
            if (now < startTime) {
              newStatus = 'upcoming';
            } else if (now >= startTime && now <= endTime) {
              newStatus = 'active';
            }
          }
          if (prevStatuses[plan.id] !== newStatus) {
            changed = true;
          }
          newStatuses[plan.id] = newStatus;
        });
        return changed ? newStatuses : prevStatuses;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [plans]);


  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const q = query(
      collection(db, "plans"),
      where("status", "==", "active"),
      where("visibility", "==", "public")
    );
    const unsubscribePlans = onSnapshot(q, (snapshot) => {
      const plansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
      plansData.sort((a, b) => a.price - b.price);
      setPlans(plansData);
      setLoading(false);
    }, (err) => {
       console.error("Error fetching plans:", err);
       setError("Could not fetch investment plans.");
       setLoading(false);
    });

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeTags = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            setPlanTags(doc.data().planTags || []);
        }
    });

    return () => {
        unsubscribePlans();
        unsubscribeTags();
    };
  }, [db, firebaseLoading]);

  // --- Plan Activation Logic ---
  const handleSelectPlan = async (plan: Plan) => {
    if (!user || !db) {
      setError("You must be logged in to select a plan.");
      return;
    }
    
    setSubmitting(true);
    setSelectedPlanId(plan.id);
    setError(null);
    
    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error("User data not found. Please try again.");
      }

      const userData = userDoc.data();
      const currentBalance = userData.balance0 || 0;
      
      let finalPrice = plan.price;
      let isDiscountApplied = false;
      let shouldGrantVipCode = false;
      
      const planDoc = await getDoc(doc(db, "plans", plan.id));
      if (planDoc.exists()) {
          const serverPlan = planDoc.data() as Plan;
          const serverOffer = serverPlan.offer;
          const now = new Date().getTime();
          if (serverOffer && serverOffer.enabled && serverOffer.startTime && serverOffer.endTime) {
              const startTime = new Date(serverOffer.startTime).getTime();
              const endTime = new Date(serverOffer.endTime).getTime();
              if(now >= startTime && now <= endTime) {
                finalPrice = plan.price * (1 - (serverOffer.discountPercentage / 100));
                isDiscountApplied = true;
                shouldGrantVipCode = serverOffer.includeVipCode || false;
              }
          }
      }

      if (currentBalance < finalPrice) {
        toast({
          variant: "destructive",
          title: "Insufficient Balance",
          description: `You need $${finalPrice.toFixed(2)} to activate this plan. Please make a deposit.`,
        });
        setSubmitting(false);
        setSelectedPlanId(null);
        return;
      }
      
      const batch = writeBatch(db);

      // 1. Deduct balance from user
      batch.update(userDocRef, {
        balance0: increment(-finalPrice),
      });

      // 2. Create the new user plan document with the correct data structure
      const userPlanRef = doc(collection(db, "userPlans"));
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + plan.durationDays);

      batch.set(userPlanRef, {
          userId: user.uid,
          planName: plan.planName,
          planAmount: plan.price,
          purchasePrice: finalPrice,
          dailyReward: plan.dailyProfit,
          durationDays: plan.durationDays,
          daysCompleted: 0,
          status: 'active',
          lastClaimTimestamp: null,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
      });
      
      // 3. Create Notification
      const notifRef = doc(collection(db, "users", user.uid, "notifications"));
      const notifMessage = isDiscountApplied
        ? `You have successfully activated the ${plan.planName} for a discounted price of $${finalPrice.toFixed(2)}.`
        : `You have successfully activated the ${plan.planName} for $${finalPrice.toFixed(2)}.`;
      batch.set(notifRef, {
        userId: user.uid,
        type: 'plan',
        title: '🎉 Plan Activated',
        message: notifMessage,
        amount: finalPrice,
        status: 'unread',
        seen: false,
        createdAt: serverTimestamp(),
        relatedId: userPlanRef.id,
      });

      // 4. Create Activity Log
      const activityLogRef = doc(collection(db, "activityLogs"));
      batch.set(activityLogRef, {
          userId: user.uid,
          action: 'plan_purchase',
          details: `Purchased plan: ${plan.planName} for $${finalPrice.toFixed(2)}`,
          timestamp: serverTimestamp(),
          relatedId: userPlanRef.id,
      });

      // 5. Create Admin Alert for VIP Code if applicable
      if (shouldGrantVipCode) {
         // Notify user about the upcoming VIP code
        const vipNotifRef = doc(collection(db, "users", user.uid, "notifications"));
        batch.set(vipNotifRef, {
            userId: user.uid,
            type: 'success',
            title: '🎁 Free VIP Code Earned!',
            message: `You've earned a free VIP code for purchasing the ${plan.planName} during our promotion. Our team will send it to your VIP Mailbox shortly.`,
            status: 'unread',
            seen: false,
            createdAt: serverTimestamp(),
        });
        // Create an admin alert for manual code distribution
        const adminAlertRef = doc(collection(db, "adminAlerts"));
        batch.set(adminAlertRef, {
            type: 'vip_code_earned',
            message: `User ${user.email} purchased package "${plan.planName}" and is eligible for a free VIP code.`,
            userId: user.uid,
            userEmail: user.email,
            relatedId: userPlanRef.id,
            createdAt: serverTimestamp(),
            status: 'new'
        });
      }
      
      // Commit all database changes
      await batch.commit();
      
      toast({
        title: "Plan activated!",
        description: `${plan.planName} has been successfully activated.`,
        className: "bg-green-500 text-white"
      });
      router.push("/dashboard");

    } catch(err: any) {
       setError(err.message || "Could not read user balance.");
       setSubmitting(false);
       setSelectedPlanId(null);
    }
  };

  if (authLoading || loading) {
    return <Loader />;
  }
  
  // Reusable component for plan details
  const PlanDetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | React.ReactNode }) => (
    <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary/80" />
        <div className="text-sm">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-bold text-white">{value}</p>
        </div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-5xl">
        <Card className="border-border/20 shadow-lg shadow-primary/5 mb-6 bg-transparent">
          <CardHeader className="text-center">
              <Rocket className="h-10 w-10 text-accent mx-auto" />
            <CardTitle className="text-3xl text-white font-bold font-headline">
                Investment Plans
            </CardTitle>
            <CardDescription className="text-white/80">
                Choose a plan to start earning daily rewards. Your balance will be used for activation.
            </CardDescription>
          </CardHeader>
        </Card>

        {error && (
            <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Activation Failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isSoldOut = plan.tag === 'LIMITED';
            const offerStatus = planOfferStatuses[plan.id] || 'inactive';
            const isOfferActive = offerStatus === 'active';
            const isOfferUpcoming = offerStatus === 'upcoming';
            const offer = plan.offer;
            const tag = planTags.find(t => t.name === plan.tag);
            
            const discountPercentage = (isOfferActive && offer) ? offer.discountPercentage : 0;
            const discountedPrice = plan.price * (1 - (discountPercentage / 100));
            const cardGlowColor = isOfferActive ? 'hsl(142 71% 45%)' : isOfferUpcoming ? 'hsl(187 71% 45%)' : tag?.color ?? 'hsl(var(--accent))';


            return (
                <div key={plan.id} className="plan-card-container group">
                    <div className="plan-card-glow" style={{'--glow-color': cardGlowColor} as React.CSSProperties}/>
                    <Card className="plan-card">
                    
                    {isOfferUpcoming && offer?.startTime && (
                         <div className="absolute top-4 inset-x-4 z-20 flex justify-center">
                              <div className="text-xs font-semibold text-cyan-900 bg-white/10 backdrop-blur-md border border-cyan-300/30 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
                                 <Clock size={20} className="text-cyan-300"/>
                                 <div>
                                     <span className="font-bold block text-sm text-cyan-200">Offer Starts In:</span>
                                     <OfferCountdown targetDate={offer.startTime} />
                                 </div>
                                 <div className="border-l border-cyan-300/20 h-10 mx-1"></div>
                                 <div className="text-center">
                                     <span className="font-extrabold text-2xl block text-white">{offer.discountPercentage}%</span>
                                     <span className="font-bold -mt-1 block text-cyan-200">OFF</span>
                                 </div>
                             </div>
                         </div>
                    )}
                    
                    {isOfferActive && offer?.endTime && (
                         <div className="absolute top-4 inset-x-4 z-20 flex justify-center">
                            <div className="text-xs font-semibold text-green-900 bg-white/10 backdrop-blur-md border border-green-300/30 rounded-lg px-4 py-2 flex items-center gap-3 shadow-lg">
                               <Clock size={20} className="text-green-300"/>
                               <div>
                                   <span className="font-bold block text-sm text-green-200">Offer Ends In:</span>
                                   <OfferCountdown targetDate={offer.endTime} />
                               </div>
                           </div>
                       </div>
                    )}

                    {tag && !isOfferActive && !isOfferUpcoming && (
                        <Badge className="absolute top-4 right-4 border-none z-20" style={{ backgroundColor: tag.color }}>
                            <Tag className="mr-1.5 h-3 w-3" />
                            {tag.name}
                        </Badge>
                    )}
                    <CardHeader className={cn("text-left relative z-10", (isOfferUpcoming || isOfferActive) ? "pt-28" : "pt-6")}>
                        <h3 className="text-2xl text-white font-bold font-headline">{plan.planName}</h3>
                        
                        {isOfferActive ? (
                            <div className="flex items-baseline gap-2 py-1">
                                <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500">
                                    ${discountedPrice.toFixed(2)}
                                </p>
                                <p className="text-2xl font-bold text-muted-foreground line-through">
                                    ${plan.price.toFixed(2)}
                                </p>
                            </div>
                        ) : (
                             <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent py-1">
                                ${plan.price.toFixed(2)}
                            </p>
                        )}
                        
                    </CardHeader>
                    <CardContent className="flex-grow p-6 grid gap-5 relative z-10">
                        <div className="grid grid-cols-2 gap-4">
                            <PlanDetailItem icon={Zap} label="Daily Reward" value={`$${plan.dailyProfit.toFixed(2)}`} />
                            <PlanDetailItem icon={CalendarDays} label="Duration" value={`${plan.durationDays} days`} />
                        </div>
                        <div className="border-t border-border/20 pt-4 grid gap-4">
                           <PlanDetailItem icon={TrendingUp} label="Total Return" value={`$${plan.totalProfit.toFixed(2)}`} />
                           {isOfferActive && offer && offer.discountPercentage > 0 && <PlanDetailItem icon={Percent} label="Discount" value={`${offer.discountPercentage}% OFF`} />}
                           {isOfferActive && offer?.includeVipCode && <PlanDetailItem icon={KeyRound} label="Bonus" value={<span className="text-yellow-400">Free VIP Code</span>} />}
                        </div>
                         {plan.description && <p className="text-xs text-center text-muted-foreground pt-3">{plan.description}</p>}
                    </CardContent>
                    <CardFooter className="relative z-10 flex-col gap-2">
                        <Button 
                            className="w-full font-bold text-base h-12" 
                            onClick={() => handleSelectPlan(plan)}
                            disabled={submitting || isSoldOut}
                        >
                        {submitting && selectedPlanId === plan.id ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            isSoldOut ? 'Sold Out' : 'Activate Plan'
                        )}
                        </Button>
                         {isOfferUpcoming && (
                             <p className="text-xs text-muted-foreground text-center">You can activate this plan now at the regular price.</p>
                        )}
                    </CardFooter>
                    </Card>
                </div>
            )
          })}
        </div>
        {!loading && plans.length === 0 && (
            <div className="text-center p-10 bg-muted/20 rounded-lg border-dashed border-border/40">
                <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                <p className="text-white font-bold">No Plans Available</p>
                <p className="text-center text-muted-foreground mt-2">No investment plans are available at the moment. Please check back later.</p>
            </div>
        )}
      </div>

       <style jsx>{`
        .plan-card-container {
          position: relative;
        }
        .plan-card {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          border-color: hsl(var(--border) / 0.4);
          background-color: hsl(var(--card) / 0.6);
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
          overflow: hidden;
        }
        .plan-card-container:hover .plan-card {
            transform: translateY(-5px);
            border-color: var(--glow-color);
        }
        .plan-card-glow {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: var(--radius);
            opacity: 0;
            transition: opacity 0.4s ease;
            filter: blur(25px);
            z-index: 0;
            background-color: var(--glow-color);
        }
        .plan-card-container:hover .plan-card-glow {
            opacity: 0.25;
        }
       `}</style>
    </div>
  );
}
