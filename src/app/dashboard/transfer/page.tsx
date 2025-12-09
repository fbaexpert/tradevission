
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import {
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  doc,
  serverTimestamp,
  writeBatch,
  onSnapshot
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  LoaderCircle,
  Send,
  UserSearch,
  AlertCircle,
  DollarSign,
  Coins,
  Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type AssetType = "balance" | "cpm_coin";

interface UserBalance {
    balance: number;
    cpmCoin: number;
}

export default function TransferPage() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [assetType, setAssetType] = useState<AssetType>("balance");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [amount, setAmount] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    recipientName: string;
    amount: number;
    asset: AssetType;
  } | null>(null);

  const [balance, setBalance] = useState<UserBalance>({ balance: 0, cpmCoin: 0 });

  useEffect(() => {
    if (!user || !db) return;

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => {
        const data = doc.data();
        setBalance(prev => ({ ...prev, balance: data?.balance0 || 0 }));
    });

    const unsubCoin = onSnapshot(doc(db, "cpm_coins", user.uid), (doc) => {
        const data = doc.data();
        setBalance(prev => ({ ...prev, cpmCoin: data?.amount || 0 }));
    });

    return () => {
        unsubUser();
        unsubCoin();
    };

  }, [user, db]);

  const handlePrepareTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user || !db) {
        setError("You must be logged in to make a transfer.");
        return;
    }
    if (recipientEmail.toLowerCase() === user.email?.toLowerCase()) {
        setError("You cannot send funds to yourself.");
        return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
        setError("Please enter a valid, positive amount to transfer.");
        return;
    }
    
    const currentBalance = assetType === 'balance' ? balance.balance : balance.cpmCoin;
    if (transferAmount > currentBalance) {
        setError(`Insufficient funds. Your current ${assetType === 'balance' ? 'balance is $' : 'CPM Coin balance is '}${currentBalance}.`);
        return;
    }

    setLoading(true);

    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", recipientEmail.toLowerCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            throw new Error("Recipient not found. Please check the email address.");
        }

        const recipientDoc = querySnapshot.docs[0];
        const recipientData = recipientDoc.data();

        setConfirmation({
            recipientName: recipientData.name,
            amount: transferAmount,
            asset: assetType,
        });

    } catch (err: any) {
        setError(err.message);
    } finally {
        setLoading(false);
    }
  };

  const executeTransfer = async () => {
    if (!confirmation || !user || !db) return;

    setLoading(true);
    setError(null);

    try {
        await runTransaction(db, async (transaction) => {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", recipientEmail.toLowerCase()));
            const querySnapshot = await getDocs(q);
            const recipientDoc = querySnapshot.docs[0];

            const senderRef = doc(db, "users", user.uid);
            const senderDoc = await transaction.get(senderRef);

            if (!senderDoc.exists()) {
                throw new Error("Your user data could not be found.");
            }
            
            const senderData = senderDoc.data();
            const { amount, asset } = confirmation;

            if (asset === 'balance') {
                const senderBalance = senderData.balance0 || 0;
                if (senderBalance < amount) {
                    throw new Error("You no longer have sufficient balance for this transfer.");
                }
                transaction.update(senderRef, { balance0: senderBalance - amount });
                transaction.update(recipientDoc.ref, { balance0: (recipientDoc.data().balance0 || 0) + amount });
            } else { // CPM Coin
                const senderCoinRef = doc(db, "cpm_coins", user.uid);
                const senderCoinDoc = await transaction.get(senderCoinRef);
                const senderCoinBalance = senderCoinDoc.exists() ? senderCoinDoc.data().amount : 0;

                if (senderCoinBalance < amount) {
                    throw new Error("You no longer have sufficient CPM Coins for this transfer.");
                }
                
                const recipientCoinRef = doc(db, "cpm_coins", recipientDoc.id);
                const recipientCoinDoc = await transaction.get(recipientCoinRef);
                const recipientCoinBalance = recipientCoinDoc.exists() ? recipientCoinDoc.data().amount : 0;
                
                transaction.set(senderCoinRef, { amount: senderCoinBalance - amount }, { merge: true });
                transaction.set(recipientCoinRef, { amount: recipientCoinBalance + amount }, { merge: true });
            }

            // Create notifications in a separate batch after the transaction
        });

        // Notifications and Logs (outside transaction)
        const batch = writeBatch(db);
        const q = query(collection(db, "users"), where("email", "==", recipientEmail.toLowerCase()));
        const querySnapshot = await getDocs(q);
        const recipientId = querySnapshot.docs[0].id;
        const recipientName = querySnapshot.docs[0].data().name;

        const assetLabel = confirmation.asset === 'balance' ? `$${confirmation.amount.toFixed(2)}` : `${confirmation.amount} CPM`;

        // Sender Notification
        const senderNotifRef = doc(collection(db, "users", user.uid, "notifications"));
        batch.set(senderNotifRef, {
            userId: user.uid, type: 'success', title: '💸 Transfer Sent',
            message: `You successfully sent ${assetLabel} to ${recipientName}.`, status: 'unread',
            seen: false, createdAt: serverTimestamp()
        });

        // Recipient Notification
        const recipientNotifRef = doc(collection(db, "users", recipientId, "notifications"));
        batch.set(recipientNotifRef, {
            userId: recipientId, type: 'success', title: '💰 Funds Received',
            message: `You have received ${assetLabel} from ${user.displayName}.`, status: 'unread',
            seen: false, createdAt: serverTimestamp()
        });

        // Activity Log for sender
        const activityLogRef = doc(collection(db, "activityLogs"));
        batch.set(activityLogRef, {
            userId: user.uid, action: `transfer_sent_${confirmation.asset}`,
            details: `Sent ${assetLabel} to ${recipientEmail}.`, timestamp: serverTimestamp()
        });

        await batch.commit();

        toast({
            title: "Transfer Successful!",
            description: `You have sent ${assetLabel} to ${confirmation.recipientName}.`,
        });

    } catch (err: any) {
        setError(err.message);
        toast({
            variant: "destructive",
            title: "Transfer Failed",
            description: err.message,
        });
    } finally {
        setLoading(false);
        setConfirmation(null);
        setAmount("");
        setRecipientEmail("");
    }
  };

  const getBalanceLabel = () => {
    return assetType === 'balance' 
        ? `Balance: $${balance.balance.toFixed(2)}`
        : `Balance: ${balance.cpmCoin.toLocaleString()} CPM`
  }

  return (
    <>
      <div className="p-4 sm:p-6 md:p-8 flex items-center justify-center min-h-[calc(100vh-10rem)] md:min-h-0">
        <div className="container mx-auto max-w-lg">
          <Card className="border-border/20 shadow-lg shadow-primary/5">
            <CardHeader className="text-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <Send className="h-8 w-8 text-accent" />
                <CardTitle className="text-2xl font-bold text-white font-headline">
                  Transfer Funds
                </CardTitle>
                <CardDescription>
                  Send Balance or CPM Coins to another user.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePrepareTransfer} className="space-y-6">
                <div className="space-y-2">
                    <Label>Asset to Send</Label>
                    <RadioGroup
                        value={assetType}
                        onValueChange={(v) => setAssetType(v as AssetType)}
                        className="grid grid-cols-2 gap-4"
                        >
                        <Label className="flex items-center gap-3 p-4 border rounded-md cursor-pointer has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors">
                            <RadioGroupItem value="balance" id="balance" />
                            <DollarSign/> Balance (USD)
                        </Label>
                        <Label className="flex items-center gap-3 p-4 border rounded-md cursor-pointer has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors">
                            <RadioGroupItem value="cpm_coin" id="cpm_coin" />
                            <Coins/> CPM Coins
                        </Label>
                    </RadioGroup>
                </div>

                <div>
                  <Label htmlFor="recipientEmail">Recipient's Email</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="Enter recipient's email address"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div>
                   <div className="flex justify-between items-baseline">
                     <Label htmlFor="amount">Amount</Label>
                     <span className="text-sm text-muted-foreground">{getBalanceLabel()}</span>
                   </div>
                    <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount to send"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={loading}
                    step="any"
                    />
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Alert>
                    <Info className="h-4 w-4"/>
                    <AlertTitle>Important</AlertTitle>
                    <AlertDescription>
                        Please double-check the recipient's email address. Transfers are irreversible.
                    </AlertDescription>
                </Alert>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <LoaderCircle className="animate-spin" /> : <UserSearch/>}
                  <span>Verify Recipient & Continue</span>
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <AlertDialog open={!!confirmation} onOpenChange={() => setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Transfer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to send{" "}
              <span className="font-bold text-white">
                {confirmation?.asset === 'balance' ? `$${confirmation?.amount.toFixed(2)}` : `${confirmation?.amount} CPM Coins`}
              </span>{" "}
              to <span className="font-bold text-white">{confirmation?.recipientName}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeTransfer} disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : "Yes, Send Now"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

    