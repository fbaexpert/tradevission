
"use client";

import { useEffect, useState } from "react";
import { useFirebase } from "@/lib/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  Timestamp,
  doc,
  writeBatch,
  getDoc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Rocket, LoaderCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


interface UserPlan {
  id: string;
  userId: string;
  planName: string;
  planAmount: number;
  dailyReward: number;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'active' | 'expired';
}

export default function AdminUserPlansPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [users, setUsers] = useState<Record<string, { email: string; name: string }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const [isDeactivating, setIsDeactivating] = useState<string | null>(null);

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);
    
    // Fetch all users to map userId to email/name
    const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData: Record<string, { email: string; name: string }> = {};
        snapshot.forEach(doc => {
            usersData[doc.id] = { email: doc.data().email, name: doc.data().name };
        });
        setUsers(usersData);
    });

    const q = query(collection(db, "userPlans"));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const plansData: UserPlan[] = [];
      querySnapshot.forEach(async (doc) => {
        const planData = { id: doc.id, ...doc.data() } as UserPlan;
        const endDate = planData.endDate.toDate();
        if (new Date() > endDate && planData.status !== 'expired') {
          // This check is now primarily done on the user's dashboard,
          // but we can keep it here as a fallback for the admin view.
          await updateDoc(doc.ref, { status: 'expired' });
          planData.status = 'expired';
        }
        plansData.push(planData);
      });
      setUserPlans(plansData.sort((a, b) => b.startDate.seconds - a.startDate.seconds));
      setLoading(false);
    });

    return () => {
        unsubscribe();
        usersUnsubscribe();
    };
  }, [db, firebaseLoading]);

  const handleDeactivatePlan = (plan: UserPlan) => {
    if (!db) return;
    setIsDeactivating(plan.id);
    const batch = writeBatch(db);

    const userPlanRef = doc(db, "userPlans", plan.id);

    // Create a notification for the user
    const notifRef = doc(collection(db, "users", plan.userId, "notifications"));
    batch.set(notifRef, {
        userId: plan.userId,
        type: 'admin',
        title: 'Plan Deactivated by Admin',
        message: `Your investment plan "${plan.planName}" has been deactivated. For refund inquiries, please contact our support team.`,
        amount: 0,
        status: 'unread',
        seen: false,
        createdAt: serverTimestamp(),
        relatedId: plan.id,
    });

    // Delete the user's plan
    batch.delete(userPlanRef);

    batch.commit().then(() => {
        toast({
            title: "Plan Deactivated",
            description: `Successfully deactivated ${plan.planName} for ${users[plan.userId]?.email}. No refund was issued.`,
        });
    }).catch((error) => {
        console.error("Error deactivating plan:", error);
        toast({
            variant: "destructive",
            title: "Deactivation Failed",
            description: "An error occurred while deactivating the plan.",
        });
    }).finally(() => {
        setIsDeactivating(null);
    });
  }

  const getDaysLeft = (plan: UserPlan) => {
    const now = new Date();
    const end = plan.endDate.toDate();
    if (end < now) return 0;
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const filteredPlans = userPlans.filter(plan => {
      const user = users[plan.userId];
      if (!user) return false;
      return user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
             user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             plan.planName.toLowerCase().includes(searchTerm.toLowerCase());
  });

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
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket />
                User Active Plans
              </CardTitle>
              <CardDescription>
                View and manage all active investment plans for users.
              </CardDescription>
            </div>
            <Input
              placeholder="Search by user, email or plan..."
              className="max-w-full md:max-w-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Daily Reward</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Days Left</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlans.map((plan) => {
                  const daysLeft = getDaysLeft(plan);
                  const status = plan.status === 'expired' || daysLeft <= 0 ? 'Expired' : 'Active';
                  return (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-medium break-all">{users[plan.userId]?.name || '...'}</div>
                      <div className="text-sm text-foreground break-all">{users[plan.userId]?.email || '...'}</div>
                    </TableCell>
                    <TableCell><Badge>{plan.planName}</Badge></TableCell>
                    <TableCell>${plan.planAmount.toFixed(2)}</TableCell>
                    <TableCell>${plan.dailyReward.toFixed(2)}</TableCell>
                    <TableCell>
                      {plan.startDate.toDate().toLocaleDateString()}
                    </TableCell>
                     <TableCell>
                      {plan.endDate.toDate().toLocaleDateString()}
                     </TableCell>
                     <TableCell>
                      {daysLeft}
                     </TableCell>
                    <TableCell>
                      <Badge variant={status === 'Active' ? 'default' : 'destructive'}>
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {status === 'Active' && (
                        isDeactivating === plan.id ? 
                        <LoaderCircle className="animate-spin ml-auto" /> :
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                               <XCircle className="mr-2 h-4 w-4"/> Deactivate
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will deactivate the plan "{plan.planName}" for {users[plan.userId]?.email}. The user will NOT be refunded. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeactivatePlan(plan)} className="bg-destructive hover:bg-destructive/90">
                                Yes, Deactivate
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {filteredPlans.length === 0 && (
            <p className="text-center text-foreground mt-4">
              No active plans found.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
