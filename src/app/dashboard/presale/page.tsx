
"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertTriangle,
  Wallet,
  LoaderCircle,
  Info,
  Percent,
  Clock,
  ShieldCheck,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { getFirebase } from "@/lib/firebase/config";
import {
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  collection,
  increment,
  query,
  where,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { CpmCoinIcon } from "@/components/shared/cpm-coin-icon";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CpmCoinOffer {
  enabled: boolean;
  title: string;
  bonusPercentage: number;
  startTime: string;
  endTime: string;
  description: string;
  includeVipCode?: boolean;
}

interface CpmCoinPackage {
  id: string;
  name: string;
  coinAmount: number;
  price: number;
  originalPrice?: number;
  tagline?: string;
  includeVipCode?: boolean;
}

interface CpmPresaleSettings {
  packages: CpmCoinPackage[];
}

const OfferCountdown = ({
  targetDate,
  onEnd,
}: {
  targetDate: string;
  onEnd?: () => void;
}) => {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

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
          <span className="text-xl sm:text-2xl font-bold text-white tabular-nums">
            {String(value).padStart(2, "0")}
          </span>
          <span className="text-xs text-muted-foreground capitalize">
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function PreSalePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<CpmCoinOffer | null>(null);
  const [presaleSettings, setPresaleSettings] = useState<CpmPresaleSettings | null>(null);
  const [offerStatus, setOfferStatus] = useState<
    "inactive" | "upcoming" | "active"
  >("inactive");
  const [purchasingPackageId, setPurchasingPackageId] = useState<string | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    if (!offer || !offer.enabled) {
      setOfferStatus("inactive");
      return;
    }

    const checkOfferStatus = () => {
      const now = new Date().getTime();
      const startTime = new Date(offer.startTime).getTime();
      const endTime = new Date(offer.endTime).getTime();

      if (now < startTime) {
        setOfferStatus("upcoming");
      } else if (now >= startTime && now <= endTime) {
        setOfferStatus("active");
      } else {
        setOfferStatus("inactive");
      }
    };

    checkOfferStatus();
    const timer = setInterval(checkOfferStatus, 1000);

    return () => clearInterval(timer);
  }, [offer]);

  useEffect(() => {
    const { db } = getFirebase();
    // Listen for offer settings
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const settingsData = doc.data();
        const defaultOffer: CpmCoinOffer = {
          enabled: false,
          title: "",
          bonusPercentage: 0,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          description: "",
          includeVipCode: false,
        };
        const defaultPresale: CpmPresaleSettings = {
          packages: [],
        };
        setOffer({ ...defaultOffer, ...(settingsData.cpmCoinOffer || {}) });
        setPresaleSettings({
          ...defaultPresale,
          ...(settingsData.cpmPresale || {}),
        });
      }
      setLoadingSettings(false);
    });
    
    return () => {
      unsubscribeSettings();
    };
  }, []);
  
  const COIN_NAME = "CPM Coin";

  const handlePurchase = async (pkg: CpmCoinPackage) => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to purchase.",
      });
      return;
    }

    setLoading(true);
    setPurchasingPackageId(pkg.id);
    setError(null);
    const { db } = getFirebase();

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        throw new Error("User data could not be found.");
      }

      const userData = userDoc.data();
      const userBalance = userData.balance0 || 0;

      if (userBalance < pkg.price) {
        throw new Error(
          `Insufficient balance. You need $${pkg.price.toFixed(
            2
          )} to purchase the ${pkg.name}.`
        );
      }

      // Final server-side check for active offer
      const settingsDoc = await getDoc(doc(db, "system", "settings"));
      let finalBonusCoins = 0;
      let finalOfferTitle: string | null = null;
      let shouldGrantVipCode = pkg.includeVipCode || false;

      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        if (settingsData && settingsData.cpmCoinOffer) {
          const serverOffer = settingsData.cpmCoinOffer as CpmCoinOffer;
          if (serverOffer.enabled) {
            const now = new Date().getTime();
            const startTime = new Date(serverOffer.startTime).getTime();
            const endTime = new Date(serverOffer.endTime).getTime();
            if (now >= startTime && now <= endTime) {
              finalBonusCoins = Math.floor(
                pkg.coinAmount * (serverOffer.bonusPercentage / 100)
              );
              finalOfferTitle = serverOffer.title;
              if (serverOffer.includeVipCode) {
                 shouldGrantVipCode = true;
              }
            }
          }
        }
      }
      const finalTotalCoinsReceived = pkg.coinAmount + finalBonusCoins;

      const batch = writeBatch(db);

      // 1. Deduct from user balance
      batch.update(userDocRef, {
        balance0: increment(-pkg.price),
      });

      // 2. Add or update user's coin balance (including bonus)
      const coinDocRef = doc(db, "cpm_coins", user.uid);
      batch.set(
        coinDocRef,
        {
          amount: increment(finalTotalCoinsReceived),
          userId: user.uid,
          lastPurchaseAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 3. Create a transaction log
      const logRef = doc(collection(db, "cpm_purchase_logs"));
      batch.set(logRef, {
        userId: user.uid,
        packageName: pkg.name,
        quantity: pkg.coinAmount,
        pricePerCoin: pkg.price / pkg.coinAmount,
        totalPrice: pkg.price,
        bonusCoins: finalBonusCoins,
        offerTitle: finalOfferTitle,
        createdAt: serverTimestamp(),
      });

      // 4. Grant free VIP code if applicable - MANUAL ADMIN NOTIFICATION
      if (shouldGrantVipCode) {
        // Notify user about the upcoming VIP code
        const vipNotifRef = doc(collection(db, "users", user.uid, "notifications"));
        batch.set(vipNotifRef, {
            userId: user.uid,
            type: 'success',
            title: '🎁 Free VIP Code Earned!',
            message: `You've earned a free VIP code for purchasing the ${pkg.name}. Our team will send it to your VIP Mailbox shortly.`,
            status: 'unread',
            seen: false,
            createdAt: serverTimestamp(),
        });
        // Create an admin alert for manual code distribution
        const adminAlertRef = doc(collection(db, "adminAlerts"));
        batch.set(adminAlertRef, {
            type: 'vip_code_earned',
            message: `User ${user.email} purchased package "${pkg.name}" and is eligible for a free VIP code.`,
            userId: user.uid,
            userEmail: user.email,
            relatedId: logRef.id,
            createdAt: serverTimestamp(),
            status: 'new'
        });
      }
      
      // 5. Send purchase notification
      const notifRef = doc(
        collection(db, "users", user.uid, "notifications")
      );
      batch.set(notifRef, {
        userId: user.uid,
        type: "success",
        title: `🎉 ${COIN_NAME} Purchased!`,
        message: `You successfully purchased ${
          pkg.coinAmount
        } ${COIN_NAME} ${
          finalBonusCoins > 0 ? `(+${finalBonusCoins} bonus)` : ""
        } for $${pkg.price.toFixed(2)}.`,
        amount: pkg.price,
        status: "unread",
        seen: false,
        createdAt: serverTimestamp(),
        relatedId: logRef.id,
      });

      await batch.commit();

      toast({
        title: "Purchase Successful!",
        description: `You are now the owner of ${finalTotalCoinsReceived} more ${COIN_NAME}.`,
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        variant: "destructive",
        title: "Purchase Failed",
        description: err.message,
      });
    } finally {
      setLoading(false);
      setPurchasingPackageId(null);
    }
  };

  const isPurchaseDisabled = loading || loadingSettings;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-5xl space-y-8">
        <header className="text-center">
          <CpmCoinIcon className="mx-auto mb-4" />
          <h1 className="text-4xl font-extrabold text-white tracking-tight font-headline">
            {COIN_NAME} Pre-Sale
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Be an early investor. Purchase {COIN_NAME} using your account
            balance before the official launch.
          </p>
        </header>

        <div className="p-6 rounded-lg bg-background/40 border border-border/30 space-y-3 max-w-3xl mx-auto">
            <h3 className="font-bold text-white flex items-center gap-2"><Info className="h-5 w-5 text-primary"/> How It Works</h3>
            <p className="text-sm text-muted-foreground">
                Your purchase amount will be automatically deducted from your main account balance. If your balance is insufficient, please make a deposit first. 
            </p>
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-800/30 to-background border border-purple-500/30 text-center">
                <p className="font-bold text-purple-300 flex items-center justify-center gap-2">
                    <ShieldCheck size={16}/> Unlock VIP Status!
                </p>
                <p className="text-xs text-purple-300/80 mt-1">Purchasing coins grants you an exclusive VIP badge on your profile.</p>
            </div>
        </div>

        {offerStatus === "active" && offer && (
          <div className="relative overflow-hidden rounded-lg border-2 border-primary/50 bg-gradient-to-br from-primary/20 via-background to-background p-6 text-center">
            <div className="absolute -top-10 -right-10 text-primary/10">
              <Percent size={120} strokeWidth={1} />
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-primary">{offer.title}</h3>
              <p className="text-muted-foreground mt-1">
                {offer.description}
              </p>
              {offer.includeVipCode && (
                <p className="mt-2 text-sm font-bold text-yellow-400 flex items-center justify-center gap-2">
                  <KeyRound size={16} /> + Free VIP Code on select packages!
                </p>
              )}
              <div className="mt-4">
                <p className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                  <Clock size={16} /> Time Left
                </p>
                <OfferCountdown targetDate={offer.endTime} />
              </div>
            </div>
          </div>
        )}

        {offerStatus === "upcoming" && offer && (
          <div className="relative overflow-hidden rounded-lg border-2 border-accent/50 bg-gradient-to-br from-accent/20 via-background to-background p-6 text-center">
            <div className="relative z-10">
              <h3 className="text-2xl font-bold text-accent">
                Offer Starting Soon!
              </h3>
              <p className="text-muted-foreground mt-1">
                Get ready! A special promotion is about to begin.
              </p>
              <div className="mt-4">
                <p className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                  <Clock size={16} /> Starts In
                </p>
                <OfferCountdown targetDate={offer.startTime} />
              </div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {presaleSettings?.packages.map((pkg) => (
                <Card key={pkg.id} className={cn(
                    "flex flex-col border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20 transition-all duration-300 hover:shadow-primary/20 hover:-translate-y-1",
                    pkg.tagline?.toLowerCase().includes("popular") && "border-primary/50"
                )}>
                    <CardHeader className="text-center">
                        {pkg.tagline && (
                            <div className="flex justify-center">
                               <Badge variant={pkg.tagline?.toLowerCase().includes("popular") ? "default" : "secondary"}>{pkg.tagline}</Badge>
                            </div>
                        )}
                        <CardTitle className="text-2xl text-white font-bold">{pkg.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col items-center justify-center text-center space-y-4">
                        <div className="flex items-baseline gap-2">
                           <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-tr from-yellow-400 to-amber-500">{pkg.coinAmount.toLocaleString()}</span>
                           <span className="text-xl font-bold text-yellow-500">CPM</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                                 <p className="text-2xl font-bold text-muted-foreground line-through">
                                    ${pkg.originalPrice.toFixed(2)}
                                </p>
                            )}
                            <p className="text-3xl font-bold text-white">${pkg.price.toFixed(2)}</p>
                        </div>
                         {pkg.includeVipCode && (
                            <p className="text-sm font-bold text-yellow-400 flex items-center justify-center gap-2 pt-2"><KeyRound size={16}/> Includes Free VIP Code!</p>
                        )}
                    </CardContent>
                    <CardContent>
                        <Button size="lg" className="w-full font-bold" onClick={() => handlePurchase(pkg)} disabled={isPurchaseDisabled || purchasingPackageId === pkg.id}>
                            {purchasingPackageId === pkg.id ? <LoaderCircle className="animate-spin" /> : <Wallet className="mr-2"/>}
                            {loadingSettings ? 'Loading...' : 'Purchase Now'}
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>

      </div>
    </div>
  );
}
