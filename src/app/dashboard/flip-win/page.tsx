
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, getDoc, runTransaction, serverTimestamp, writeBatch, increment, collection, onSnapshot } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoaderCircle, AlertCircle, Coins, DollarSign, PartyPopper, Trophy } from "lucide-react";
import Loader from "@/components/shared/loader";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";


type AssetType = "CASH" | "CPM_COIN" | "NO_REWARD";

interface FlipReward {
    label: string;
    value: number;
    type: AssetType;
    probability: number;
}

interface FlipWinSettings {
    cost: {
        usd: number;
        cpm: number;
    };
    rewards: FlipReward[];
}

interface UserBalance {
    balance: number;
    cpmCoin: number;
}

const PlayingCard = ({
  isFlipped,
  onFlip,
  reward,
  isRevealed,
}: {
  isFlipped: boolean;
  onFlip: () => void;
  reward: FlipReward | null;
  isRevealed: boolean;
}) => {
  const isWinner = reward && reward.type !== "NO_REWARD";
  const isTryAgain = reward && reward.type === "NO_REWARD";

  return (
    <div className="card-perspective">
      <div
        className={cn("card-inner", isFlipped && "is-flipped")}
        onClick={!isRevealed ? onFlip : undefined}
      >
        <div className="card-face card-front">
          <div className="card-corner top-left">
            <span>◆</span>
          </div>
          <div className="card-logo">TV</div>
          <div className="card-corner bottom-right">
            <span>◆</span>
          </div>
        </div>
        <div className={cn(
            "card-face card-back",
            isWinner && "bg-gradient-to-br from-yellow-400 to-amber-500 text-black",
            isTryAgain && "bg-gradient-to-br from-slate-600 to-slate-800 text-white"
        )}>
            {reward && (
                <div className="flex flex-col items-center justify-center h-full text-center p-2">
                    <p className="text-xl font-bold">{reward.label}</p>
                    {reward.type === 'CASH' && <p className="text-sm">Points</p>}
                    {reward.type === 'CPM_COIN' && <p className="text-sm">CPM Coins</p>}
                </div>
            )}
        </div>
      </div>
       <style jsx>{`
            .card-perspective {
                perspective: 1000px;
                width: 120px;
                height: 180px;
            }
            .card-inner {
                position: relative;
                width: 100%;
                height: 100%;
                transition: transform 0.8s;
                transform-style: preserve-3d;
                cursor: pointer;
            }
            .card-inner.is-flipped {
                transform: rotateY(180deg);
            }
            .card-face {
                position: absolute;
                width: 100%;
                height: 100%;
                -webkit-backface-visibility: hidden;
                backface-visibility: hidden;
                border-radius: 12px;
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                border: 2px solid rgba(255,255,255,0.2);
            }
            .card-front {
                background: linear-gradient(135deg, hsl(var(--primary)/0.8), hsl(var(--primary)));
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                padding: 1rem;
                color: hsl(var(--primary-foreground));
            }
             .card-logo {
                font-size: 2.5rem;
                font-weight: 900;
                text-align: center;
                text-shadow: 2px 2px 5px rgba(0,0,0,0.3);
            }
            .card-corner { font-size: 1rem; }
            .bottom-right { transform: rotate(180deg); }

            .card-back {
                transform: rotateY(180deg);
            }
        `}</style>
    </div>
  );
};


export default function FlipWinPage() {
    const { user, loading: authLoading } = useAuth();
    const { db, loading: firebaseLoading } = useFirebase();
    const { toast } = useToast();

    const [settings, setSettings] = useState<FlipWinSettings | null>(null);
    const [balance, setBalance] = useState<UserBalance>({ balance: 0, cpmCoin: 0 });
    const [loadingData, setLoadingData] = useState(true);
    
    const [paymentMethod, setPaymentMethod] = useState<'usd' | 'cpm'>('usd');
    const [flippedIndex, setFlippedIndex] = useState<number | null>(null);
    const [rewards, setRewards] = useState<(FlipReward | null)[]>([null, null, null]);
    const [isRevealed, setIsRevealed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [playing, setPlaying] = useState(false);
    
    const finalReward = isRevealed && flippedIndex !== null ? rewards[flippedIndex] : null;

    useEffect(() => {
        if (!db) return;
        setLoadingData(true);
        const settingsRef = doc(db, "system", "flipWinSettings");
        const unsubSettings = onSnapshot(settingsRef, (doc) => {
            if (doc.exists()) setSettings(doc.data() as FlipWinSettings);
            if(user) { // only stop loading if user is also loaded or not available
                setLoadingData(false);
            }
        });
        
        let unsubUser: () => void = () => {}, unsubCoin: () => void = () => {};
        if (user) {
            unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => {
                setBalance(prev => ({ ...prev, balance: doc.data()?.balance0 || 0 }));
            });
            unsubCoin = onSnapshot(doc(db, "cpm_coins", user.uid), (doc) => {
                setBalance(prev => ({ ...prev, cpmCoin: doc.data()?.amount || 0 }));
            });
        } else if (!authLoading) {
            setLoadingData(false);
        }

        return () => { unsubSettings(); unsubUser(); unsubCoin(); };
    }, [db, user, authLoading]);

    const handleFlip = async (index: number) => {
        if (playing || isRevealed || !user || !db || !settings) return;

        setPlaying(true);
        setError(null);
        
        const cost = settings.cost[paymentMethod];
        const userBalance = paymentMethod === 'usd' ? balance.balance : balance.cpmCoin;

        if (userBalance < cost) {
            setError(`Insufficient ${paymentMethod === 'usd' ? 'balance' : 'CPM Coins'}.`);
            setPlaying(false);
            return;
        }

        try {
             const result = await runTransaction(db, async (transaction) => {
                const userRef = doc(db, "users", user.uid);
                const userCoinRef = doc(db, "cpm_coins", user.uid);
                
                const userDoc = await transaction.get(userRef);
                const userCoinDoc = await transaction.get(userCoinRef);
                
                const currentBalance = userDoc.data()?.balance0 || 0;
                const currentCpmCoins = userCoinDoc.exists() ? userCoinDoc.data().amount : 0;
                
                const rewards = settings.rewards;
                const totalProbability = rewards.reduce((acc, reward) => acc + (reward.probability || 0), 0);
                let randomPoint = Math.random() * totalProbability;
                
                let winningReward: FlipReward | null = null;
                for (let reward of rewards) {
                    if (randomPoint < (reward.probability || 0)) {
                        winningReward = reward;
                        break;
                    }
                    randomPoint -= (reward.probability || 0);
                }
                if (!winningReward) winningReward = rewards[rewards.length - 1];

                if (paymentMethod === 'usd') {
                    if (currentBalance < cost) throw new Error("Insufficient balance.");
                    let newBalance = currentBalance - cost;
                    if (winningReward.type === "CASH") newBalance += winningReward.value;
                    transaction.update(userRef, { balance0: newBalance });
                    
                    if (winningReward.type === "CPM_COIN") {
                        transaction.set(userCoinRef, { amount: currentCpmCoins + winningReward.value, userId: user.uid }, { merge: true });
                    }
                } else { // Paying with CPM
                    if (currentCpmCoins < cost) throw new Error("Insufficient CPM Coins.");
                    let newCpmBalance = currentCpmCoins - cost;
                    if (winningReward.type === "CPM_COIN") newCpmBalance += winningReward.value;
                    transaction.set(userCoinRef, { amount: newCpmBalance, userId: user.uid }, { merge: true });
                    
                    if (winningReward.type === "CASH") {
                        transaction.update(userRef, { balance0: currentBalance + winningReward.value });
                    }
                }
                
                return winningReward;
            });

            if(result) {
                const newRewards: (FlipReward | null)[] = [null, null, null];
                newRewards[index] = result;
                setRewards(newRewards);
                setFlippedIndex(index);
                setIsRevealed(true);
                
                setTimeout(() => {
                    const assetLabel = result.type === 'CASH' ? `${result.value.toFixed(2)} Points` : `${result.value} CPM`;
                     if (result.type !== "NO_REWARD") {
                        toast({ title: "Congratulations!", description: `You won ${assetLabel}!` });
                    } else {
                        toast({ title: "Better Luck Next Time!", description: "Keep flipping to increase your chances of winning." });
                    }
                }, 800);
            }

        } catch (err: any) {
            setError(err.message);
        } finally {
            setPlaying(false);
        }
    };
    
    const handleTryAgain = () => {
        setFlippedIndex(null);
        setRewards([null, null, null]);
        setIsRevealed(false);
        setError(null);
    }
    
    const isLoading = authLoading || firebaseLoading || loadingData;
    if (isLoading) return <Loader />;
    
    const cost = settings?.cost[paymentMethod];
    const prizes = settings?.rewards.filter(r => r.type !== 'NO_REWARD') || [];

    return (
        <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh_-_var(--header-height))]">
             <Card className="max-w-4xl w-full border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                <CardHeader className="text-center">
                    <CardTitle className="text-3xl font-bold text-white font-headline">Flip & Win</CardTitle>
                    <CardDescription>Flip a card to reveal your prize. Fortune favors the bold!</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-8">
                    
                    {prizes.length > 0 && (
                        <div className="w-full space-y-3">
                           <h3 className="text-center font-bold text-primary flex items-center justify-center gap-2"><Trophy size={16} /> Prize Pool</h3>
                           <Carousel 
                                opts={{ align: "start", loop: true, dragFree: true }}
                                plugins={[Autoplay({ delay: 2000, stopOnInteraction: false })]}
                                className="w-full"
                            >
                                <CarouselContent>
                                    {prizes.map((prize, i) => (
                                        <CarouselItem key={i} className="basis-1/3 md:basis-1/4 lg:basis-1/5">
                                            <div className="p-1">
                                                <div className="flex flex-col items-center justify-center p-2 h-20 rounded-lg bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 shadow-inner">
                                                     {prize.type === 'CASH' && <DollarSign className="h-5 w-5 text-green-400 mb-1"/>}
                                                     {prize.type === 'CPM_COIN' && <Coins className="h-5 w-5 text-yellow-400 mb-1"/>}
                                                     <span className="font-bold text-lg text-white">{prize.label}</span>
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                            </Carousel>
                        </div>
                    )}
                    
                    <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
                       {[0, 1, 2].map(i => (
                           <PlayingCard 
                                key={i}
                                isFlipped={flippedIndex === i}
                                onFlip={() => handleFlip(i)}
                                reward={rewards[i]}
                                isRevealed={isRevealed}
                           />
                       ))}
                    </div>

                    {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}

                    {isRevealed && finalReward ? (
                        <div className="text-center animate-in fade-in-50 duration-500 space-y-4">
                            {finalReward.type !== "NO_REWARD" ? (
                                <div className="flex flex-col items-center gap-2">
                                     <PartyPopper className="h-16 w-16 text-yellow-400" />
                                     <p className="text-sm text-muted-foreground">Congratulations! You won:</p>
                                    <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-500">
                                       {finalReward.label}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-2xl font-bold text-muted-foreground">Better Luck Next Time!</p>
                            )}
                             <Button onClick={handleTryAgain}>Try Again</Button>
                        </div>
                    ) : (
                         <div className="flex flex-col items-center gap-4 w-full max-w-sm">
                            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'usd' | 'cpm')} className="grid grid-cols-2 gap-4 w-full">
                                <Label className="flex items-center justify-center gap-2 p-3 border rounded-md has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors cursor-pointer">
                                    <RadioGroupItem value="usd" id="usd" />
                                    <DollarSign/> Use balance
                                </Label>
                                <Label className="flex items-center justify-center gap-2 p-3 border rounded-md has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors cursor-pointer">
                                    <RadioGroupItem value="cpm" id="cpm" />
                                    <Coins/> Use CPM Coins
                                </Label>
                            </RadioGroup>

                            <Button onClick={() => {}} className="w-full h-12 text-base font-bold" disabled={playing}>
                               {playing ? <LoaderCircle className="animate-spin"/> : (
                                   `Flip a Card for ${cost} ${paymentMethod === 'usd' ? 'balance' : 'CPM'}`
                               )}
                            </Button>
                            <p className="text-xs text-muted-foreground text-center px-4">More flips can increase the chance of a bonus! Good luck!</p>
                        </div>
                    )}
                </CardContent>
             </Card>
        </div>
    );
}
