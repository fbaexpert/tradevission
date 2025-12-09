
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  Timestamp,
  where,
  getDoc,
  updateDoc
} from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Star, LoaderCircle, CheckCircle, Wallet, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { useFirebase } from "@/lib/firebase/provider";


interface Commander {
  id: string;
  name: string;
  email: string;
  lastWeeklyRewardPaidAt?: Timestamp;
}

interface CommanderSettings {
    weeklySalary: number;
    weeklyCpmCoins: number;
}


export default function AdminCommanderRewardsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [settings, setSettings] = useState<CommanderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const commandersQuery = query(collection(db, "users"), where("isCommander", "==", true));
    const unsubscribeCommanders = onSnapshot(commandersQuery, (snapshot) => {
      const commandersData: Commander[] = [];
      snapshot.forEach(doc => {
          commandersData.push({ id: doc.id, ...doc.data() } as Commander);
      });
      setCommanders(commandersData);
      setLoading(false);
    });

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if(doc.exists()){
            const data = doc.data();
            setSettings(data.commander || null);
        }
    });

    return () => {
      unsubscribeCommanders();
      unsubscribeSettings();
    };
  }, [db, firebaseLoading]);

  const canPayReward = (commander: Commander) => {
    if (!commander.lastWeeklyRewardPaidAt) {
      return true; // Never been paid
    }
    const lastPaidDate = commander.lastWeeklyRewardPaidAt.toDate();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return lastPaidDate < oneWeekAgo;
  };

  const handlePayReward = async (commander: Commander) => {
    if (!settings || !canPayReward(commander) || !db) {
      toast({
        variant: "destructive",
        title: "Action Not Allowed",
        description: "This Commander is not yet eligible for another weekly reward.",
      });
      return;
    }

    setPayingId(commander.id);
    const batch = writeBatch(db);

    const userDocRef = doc(db, "users", commander.id);
    const coinDocRef = doc(db, "cpm_coins", commander.id);

    // Update user balance and last paid date
    batch.update(userDocRef, {
      balance0: increment(settings.weeklySalary),
      lastWeeklyRewardPaidAt: serverTimestamp(),
    });

    // Update CPM Coins
    batch.set(coinDocRef, {
      amount: increment(settings.weeklyCpmCoins),
      userId: commander.id,
    }, { merge: true });

    // Send notification
    const notifRef = doc(collection(db, "users", commander.id, "notifications"));
    batch.set(notifRef, {
      userId: commander.id,
      type: "success",
      title: "🏆 Weekly Commander Reward!",
      message: `You've received your weekly reward of ${settings.weeklySalary} Points and ${settings.weeklyCpmCoins} CPM Coins.`,
      status: "unread",
      seen: false,
      createdAt: serverTimestamp(),
    });

    // Log the action
    const activityLogRef = doc(collection(db, "activityLogs"));
    batch.set(activityLogRef, {
      userId: "ADMIN",
      relatedUserId: commander.id,
      action: "commander_reward_paid",
      details: `Admin paid weekly reward to Commander ${commander.email}.`,
      timestamp: serverTimestamp(),
    });

    try {
      await batch.commit();
      toast({
        title: "Reward Paid!",
        description: `Sent ${settings.weeklySalary} Points and ${settings.weeklyCpmCoins} CPM Coins to ${commander.name}.`,
      });
    } catch (error) {
      console.error("Error paying reward:", error);
      toast({
        variant: "destructive",
        title: "Payment Failed",
        description: "An unexpected error occurred while paying the reward.",
      });
    } finally {
      setPayingId(null);
    }
  };
  
  if (loading || firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white font-bold">
          <Star className="text-amber-400"/>
          Commander Rewards
        </CardTitle>
        <CardDescription>
          Manually distribute weekly salary and CPM coin rewards to your Commanders.
          {settings && (
            <span className="block mt-2 text-primary font-bold">
                Current Reward: {settings.weeklySalary} Points + {settings.weeklyCpmCoins} CPM Coins per week.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commander</TableHead>
                <TableHead>Last Paid Date</TableHead>
                <TableHead>Eligibility</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commanders.length > 0 ? commanders.map((commander) => {
                const isEligible = canPayReward(commander);
                return (
                  <TableRow key={commander.id}>
                    <TableCell>
                      <div className="font-medium text-white">{commander.name}</div>
                      <div className="text-sm text-muted-foreground">{commander.email}</div>
                    </TableCell>
                    <TableCell>
                      {commander.lastWeeklyRewardPaidAt
                        ? commander.lastWeeklyRewardPaidAt.toDate().toLocaleString()
                        : "Never"}
                    </TableCell>
                    <TableCell>
                        {isEligible ? 
                            <Badge variant="default" className="bg-green-500 hover:bg-green-600">Eligible</Badge>
                          : <Badge variant="secondary">Not Eligible</Badge>
                        }
                    </TableCell>
                    <TableCell className="text-right">
                       {payingId === commander.id ? (
                          <LoaderCircle className="animate-spin ml-auto" />
                       ) : (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" disabled={!isEligible}>
                                <Wallet className="mr-2 h-4 w-4"/> Pay Reward
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirm Reward Payment</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to pay the weekly reward of {settings?.weeklySalary} Points and {settings?.weeklyCpmCoins} CPM Coins to <span className="font-bold text-white">{commander.name}</span>?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handlePayReward(commander)}>
                                Yes, Pay Now
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                       )}
                    </TableCell>
                  </TableRow>
                )
              }) : (
                 <TableRow>
                    <TableCell colSpan={4} className="text-center h-24">
                        No users have been promoted to Commander yet.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
