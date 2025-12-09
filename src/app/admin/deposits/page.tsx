
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
  addDoc,
  deleteDoc,
  where,
  getDocs,
  getDoc
} from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ArrowDownToDot, LoaderCircle, Check, X, Copy, Trash2, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { increment } from "firebase/firestore";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Image from 'next/image';
import { useFirebase } from "@/lib/firebase/provider";

interface DepositRequest {
  id: string;
  uid: string;
  email: string;
  amount: number;
  method: "crypto";
  network: string;
  tid: string;
  screenshotUrl?: string;
  createdAt: { seconds: number; nanoseconds: number };
  status: "pending" | "approved" | "rejected";
}

export default function AdminDepositsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();
  const [viewingScreenshot, setViewingScreenshot] = useState<string | null>(null);

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);
    const q = query(collection(db, "deposits"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allDeposits: DepositRequest[] = [];
      snapshot.forEach(doc => {
          allDeposits.push({ id: doc.id, ...doc.data() } as DepositRequest);
      });
      setDeposits(allDeposits.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, firebaseLoading]);

  const handleUpdate = async (
    deposit: DepositRequest,
    newStatus: "approved" | "rejected"
  ) => {
    if (!db) return;
    setUpdatingId(deposit.id);

    const originalDeposits = [...deposits];
    setDeposits(deposits.map(d => d.id === deposit.id ? { ...d, status: newStatus } : d));

    try {
        const batch = writeBatch(db);
        const depositDocRef = doc(db, "deposits", deposit.id);

        batch.update(depositDocRef, { status: newStatus });
        
        const userDocRef = doc(db, "users", deposit.uid);
        if (newStatus === "approved") {
            let totalAmountToAdd = deposit.amount;

            // Check for active deposit boost
            const settingsDocRef = doc(db, "system", "settings");
            const settingsDoc = await getDoc(settingsDocRef);
            if (settingsDoc.exists()) {
                const settings = settingsDoc.data();
                const boost = settings.depositBoost;
                if (boost && boost.enabled && new Date() < new Date(boost.endTime)) {
                    const bonusAmount = deposit.amount * (boost.bonusPercentage / 100);
                    totalAmountToAdd += bonusAmount;
                    
                    // Send bonus notification
                    const bonusNotifRef = doc(collection(db, "users", deposit.uid, "notifications"));
                    batch.set(bonusNotifRef, {
                        userId: deposit.uid,
                        type: 'success',
                        title: `🎉 Deposit Bonus!`,
                        message: `You received a $${bonusAmount.toFixed(2)} bonus from the "${boost.title}" event!`,
                        amount: bonusAmount,
                        status: 'unread', seen: false, createdAt: serverTimestamp(),
                    });
                }
            }

            batch.update(userDocRef, { 
                balance0: increment(totalAmountToAdd),
                depositDone: true
            });
        }
        
        const notifCollectionRef = collection(db, "users", deposit.uid, "notifications");
        const notifDoc = {
            userId: deposit.uid,
            type: "deposit",
            title: newStatus === "approved" ? "✅ Deposit Approved" : "❌ Deposit Rejected",
            message: `Your deposit request for $${deposit.amount.toFixed(2)} has been ${newStatus}.`,
            amount: deposit.amount,
            status: "unread",
            seen: false,
            createdAt: serverTimestamp(),
            relatedId: deposit.id,
        };
        batch.set(doc(notifCollectionRef), notifDoc);

        const activityLogCollectionRef = collection(db, "activityLogs");
        const activityLogDoc = {
            userId: deposit.uid,
            action: `deposit_${newStatus}`,
            details: `Admin ${newStatus} deposit of $${deposit.amount.toFixed(2)}`,
            timestamp: serverTimestamp(),
        };
        batch.set(doc(activityLogCollectionRef), activityLogDoc);

        if (newStatus === 'approved') {
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                if (userData.referredBy && !userData.depositDone) {
                    const referrerRef = doc(db, "users", userData.referredBy);
                    const bonusAmount = deposit.amount * 0.15;
                    batch.update(referrerRef, {
                        balance0: increment(bonusAmount),
                        totalReferralBonus: increment(bonusAmount)
                    });
                    
                    const referrerNotifRef = doc(collection(db, "users", userData.referredBy, "notifications"));
                    batch.set(referrerNotifRef, {
                    userId: userData.referredBy,
                    type: 'success',
                    title: '🎉 Referral Bonus!',
                    message: `You earned a $${bonusAmount.toFixed(2)} bonus from your referral ${userData.name}'s first deposit.`,
                    amount: bonusAmount,
                    status: 'unread',
                    seen: false,
                    createdAt: serverTimestamp(),
                    });
                }
                if (userData.referredBy) {
                    const referrerRef = doc(db, "users", userData.referredBy);
                    batch.update(referrerRef, {
                        totalTeamDeposit: increment(deposit.amount)
                    });
                }
            }
        }

        await batch.commit();
        
        toast({
            title: "Deposit Request Updated",
            description: `Status changed to ${newStatus}.`,
        });

    } catch (error) {
        console.error("Error updating deposit status:", error);
        setDeposits(originalDeposits);
        toast({
            variant: "destructive",
            title: "Update Failed",
            description: "An error occurred while updating the request.",
        });
    } finally {
        setUpdatingId(null);
    }
  };
  
  const handleDeleteDeposit = async (id: string) => {
    if (!db) return;

    const originalDeposits = [...deposits];
    setDeposits(deposits.filter(d => d.id !== id));

    try {
        await deleteDoc(doc(db, "deposits", id));
        toast({ title: "Deposit Deleted", description: "The processed deposit has been removed." });
    } catch(error) {
        console.error("Error deleting deposit:", error);
        setDeposits(originalDeposits);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the deposit." });
    }
  };

  const handleDeleteAllProcessed = async () => {
    if (!db) return;
    const depositsRef = collection(db, "deposits");
    const q = query(depositsRef, where("status", "!=", "pending"));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: "No processed deposits to delete."});
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "All Processed Deposits Deleted", description: "All approved and rejected deposits have been removed." });
    } catch (error) {
        console.error("Error deleting all processed deposits:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all processed deposits." });
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const renderTable = (data: DepositRequest[], isProcessedTab: boolean) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method/Network</TableHead>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Screenshot</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((req) => (
            <TableRow key={req.id}>
              <TableCell>
                <div className="font-medium break-all">{req.email}</div>
                <div className="text-sm text-white/70 break-all">{req.uid}</div>
              </TableCell>
              <TableCell>${req.amount.toFixed(2)}</TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">{req.method}</Badge>
                {req.method === 'crypto' && req.network && (
                    <div className="text-xs text-white/70 mt-1">{req.network}</div>
                )}
              </TableCell>
               <TableCell>
                 <div className="flex items-center gap-1">
                  <span className="truncate max-w-[100px]">{req.tid}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(req.tid)}>
                      <Copy className="h-4 w-4" />
                  </Button>
                 </div>
               </TableCell>
              <TableCell>
                {req.screenshotUrl ? (
                    <Button variant="outline" size="sm" onClick={() => setViewingScreenshot(req.screenshotUrl!)}>
                        <ImageIcon className="mr-2 h-4 w-4" /> View
                    </Button>
                ) : "N/A"}
              </TableCell>
              <TableCell>
                {new Date(req.createdAt.seconds * 1000).toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'} className="capitalize">
                  {req.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {req.status === "pending" ? (
                  updatingId === req.id ? (
                    <LoaderCircle className="animate-spin ml-auto" />
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-500 border-green-500 hover:bg-green-500/10 hover:text-green-500"
                        onClick={() => handleUpdate(req, "approved")}
                      >
                        <Check className="mr-2 h-4 w-4" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUpdate(req, "rejected")}
                      >
                        <X className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  )
                ) : isProcessedTab ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this deposit request. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteDeposit(req.id)} className="bg-destructive hover:bg-destructive/90">
                          Yes, Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
              ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const pendingDeposits = deposits.filter(d => d.status === 'pending');
  const processedDeposits = deposits.filter(d => d.status !== 'pending');
  
  if (loading || firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white font-bold">
          <ArrowDownToDot />
          Deposit Requests
        </CardTitle>
        <CardDescription>
            Approve or reject user deposit requests. Approving will add funds to the user's balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
            <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="processed">Processed</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
                {pendingDeposits.length > 0 ? renderTable(pendingDeposits, false) : <p className="text-center text-white mt-4">No pending deposit requests.</p>}
            </TabsContent>
            <TabsContent value="processed">
                 <div className="my-4 flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={processedDeposits.length === 0}>
                          <Trash2 className="mr-2 h-4 w-4"/> Delete All Processed
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete all {processedDeposits.length} processed deposit requests (approved and rejected). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllProcessed} className="bg-destructive hover:bg-destructive/90">
                            Yes, Delete All
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                 </div>
                 {processedDeposits.length > 0 ? renderTable(processedDeposits, true) : <p className="text-center text-white mt-4">No processed deposit requests.</p>}
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <Dialog open={!!viewingScreenshot} onOpenChange={() => setViewingScreenshot(null)}>
        <DialogContent className="max-w-3xl">
            <DialogHeader>
                <DialogTitle>Deposit Screenshot</DialogTitle>
            </DialogHeader>
            {viewingScreenshot && (
                <div className="mt-4 relative" style={{ paddingTop: '56.25%' }}>
                    <Image src={viewingScreenshot} alt="Deposit screenshot" fill style={{ objectFit: 'contain' }} />
                </div>
            )}
        </DialogContent>
    </Dialog>
    </>
  );
}
