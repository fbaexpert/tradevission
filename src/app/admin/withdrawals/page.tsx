
"use client";

import { useEffect, useState } from "react";
import { useFirebase } from "@/lib/firebase/provider";
import {
  collection,
  query,
  onSnapshot,
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  deleteDoc,
  where,
  getDocs
} from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ArrowUpFromDot, LoaderCircle, Check, X, Copy, Trash2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface WithdrawalRequest {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  method: "crypto";
  coin?: string;
  walletAddress?: string;
  createdAt: { seconds: number; nanoseconds: number };
  status: "pending" | "approved" | "rejected";
}

export default function AdminWithdrawalsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);
    const q = query(collection(db, "withdrawals"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allWithdrawals: WithdrawalRequest[] = [];
      snapshot.forEach(doc => {
          allWithdrawals.push({ id: doc.id, ...doc.data() } as WithdrawalRequest);
      });
      setWithdrawals(allWithdrawals.sort((a, b) => b.createdAt.seconds - a.createdAt.seconds));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db, firebaseLoading]);

  const handleUpdate = async (
    req: WithdrawalRequest,
    newStatus: "approved" | "rejected"
  ) => {
    if (!db) return;
    setUpdatingId(req.id);

    const originalWithdrawals = [...withdrawals];
    setWithdrawals(withdrawals.map(w => w.id === req.id ? { ...w, status: newStatus } : w));
    
    try {
      const batch = writeBatch(db);
      const withdrawalDocRef = doc(db, "withdrawals", req.id);
      const userDocRef = doc(db, "users", req.userId);

      batch.update(withdrawalDocRef, { status: newStatus });
      
      if (newStatus === "approved") {
        batch.update(userDocRef, {
            totalWithdrawn: increment(req.amount)
        });
      }

      const notifCollectionRef = collection(db, "users", req.userId, "notifications");
      
      const notifMessage = newStatus === 'approved'
        ? `Your withdrawal request for $${req.amount.toFixed(2)} has been approved.`
        : `Your withdrawal request for $${req.amount.toFixed(2)} has been rejected. The amount has not been refunded to your balance.`;

      const notifDoc = {
          userId: req.userId,
          type: "withdraw",
          title: newStatus === "approved" ? "✅ Withdrawal Approved" : "❌ Withdrawal Rejected",
          message: notifMessage,
          amount: req.amount,
          status: "unread",
          seen: false,
          createdAt: serverTimestamp(),
          relatedId: req.id,
      };
      batch.set(doc(notifCollectionRef), notifDoc);

      const activityLogCollectionRef = collection(db, "activityLogs");
      const activityLogDoc = {
          userId: req.userId,
          action: `withdrawal_${newStatus}`,
          details: `Admin ${newStatus} withdrawal of $${req.amount.toFixed(2)}.`,
          timestamp: serverTimestamp(),
          relatedId: req.id,
      };
      batch.set(doc(activityLogCollectionRef), activityLogDoc);

      await batch.commit();

      toast({
        title: "Withdrawal Request Updated",
        description: `Status changed to ${newStatus}.`,
      });

    } catch (error) {
      console.error("Error updating withdrawal status:", error);
      setWithdrawals(originalWithdrawals);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while updating the request.",
      });
    } finally {
      setUpdatingId(null);
    }
  };
  
  const handleDeleteWithdrawal = async (id: string) => {
    if (!db) return;

    const originalWithdrawals = [...withdrawals];
    setWithdrawals(withdrawals.filter(w => w.id !== id));

    try {
        await deleteDoc(doc(db, "withdrawals", id));
        toast({ title: "Withdrawal Deleted", description: "The processed withdrawal has been removed." });
    } catch(error) {
        console.error("Error deleting withdrawal:", error);
        setWithdrawals(originalWithdrawals);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the withdrawal." });
    }
  };

  const handleDeleteAllProcessed = async () => {
    if (!db) return;
    const withdrawalsRef = collection(db, "withdrawals");
    const q = query(withdrawalsRef, where("status", "!=", "pending"));
    try {
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            toast({ title: "No processed withdrawals to delete."});
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "All Processed Withdrawals Deleted", description: "All approved and rejected withdrawals have been removed." });
    } catch (error) {
        console.error("Error deleting all processed withdrawals:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all processed withdrawals." });
    }
  }

  const copyToClipboard = (text: string) => {
    if(!text) return;
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const renderTable = (data: WithdrawalRequest[], isProcessedTab: boolean) => (
    <div className="overflow-x-auto">
     <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Method/Coin</TableHead>
          <TableHead>Wallet Address</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((req) => (
          <TableRow key={req.id}>
            <TableCell>
                <div className="font-medium break-all">{req.userEmail}</div>
                <div className="text-sm text-white/70 break-all">{req.userId}</div>
            </TableCell>
            <TableCell>${req.amount.toFixed(2)}</TableCell>
            <TableCell>
              <Badge variant="secondary" className="capitalize">{req.method}</Badge>
              {req.method === 'crypto' && req.coin && (
                  <div className="text-xs text-white/70 mt-1">{req.coin}</div>
              )}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                  <span className="truncate max-w-[100px]">{req.walletAddress}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(req.walletAddress!)}>
                      <Copy className="h-4 w-4" />
                  </Button>
              </div>
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
                          This will permanently delete this withdrawal request. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteWithdrawal(req.id)} className="bg-destructive hover:bg-destructive/90">
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

  const pendingWithdrawals = withdrawals.filter(d => d.status === 'pending');
  const processedWithdrawals = withdrawals.filter(d => d.status !== 'pending');

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
          <ArrowUpFromDot />
          Withdrawal Requests
        </CardTitle>
        <CardDescription>
            Approve or reject user withdrawal requests. Rejecting will NOT refund the amount to the user's balance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pending">
            <TabsList>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="processed">Processed</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
                {pendingWithdrawals.length > 0 ? renderTable(pendingWithdrawals, false) : <p className="text-center text-white mt-4">No pending withdrawal requests.</p>}
            </TabsContent>
            <TabsContent value="processed">
                 <div className="my-4 flex justify-end">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={processedWithdrawals.length === 0}>
                          <Trash2 className="mr-2 h-4 w-4"/> Delete All Processed
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete all {processedWithdrawals.length} processed withdrawal requests (approved and rejected). This action cannot be undone.
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
                 {processedWithdrawals.length > 0 ? renderTable(processedWithdrawals, true) : <p className="text-center text-white mt-4">No processed withdrawal requests.</p>}
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
