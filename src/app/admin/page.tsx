
"use client";

import { useEffect, useState } from "react";
import { useFirebase } from "@/lib/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  increment,
  getDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  deleteDoc,
  Timestamp,
  getDocs,
  where,
  setDoc,
  addDoc,
  runTransaction
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
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
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Users, LoaderCircle, Bell, Trash2, FileText, ArrowUpFromDot, Coins, Users2, Zap, ShieldCheck, Star, RefreshCw, Edit, Calendar as CalendarIcon, Monitor, Wifi, MoreHorizontal, ShieldAlert, ShieldQuestion, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { nanoid } from "nanoid";
import { httpsCallable } from "firebase/functions";

interface CustomBadge {
    id: string;
    name: string;
    color: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  balance0?: number;
  balance?: number;
  createdAt: { seconds: number; nanoseconds: number } | null;
  withdrawalStatus?: 'enabled' | 'disabled';
  cpmWithdrawalStatus?: 'enabled' | 'disabled';
  teamBonusPaused?: boolean;
  totalWithdrawn?: number;
  cpmCoins?: number;
  referredBy?: string;
  isVip?: boolean;
  totalTeamMembers?: number;
  isCommander?: boolean;
  customBadges?: CustomBadge[];
  ipAddress?: string;
  deviceInfo?: string;
  withdrawalVerification?: {
    required: boolean;
    status: 'not_verified' | 'pending_otp' | 'verified' | 'locked';
    attempts: number;
    cooldownUntil?: Timestamp;
  };
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  isVip?: boolean;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "alert" | "deposit" | "withdraw" | "plan" | "profit" | "admin";
    seen: boolean;
    createdAt: Timestamp;
}

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: Timestamp;
  [key: string]: any;
}


const typeColors: { [key: string]: string } = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  alert: "bg-red-500",
  deposit: "bg-green-500",
  withdraw: "bg-red-500",
  plan: "bg-purple-500",
  profit: "bg-green-500",
  admin: "bg-gray-500",
};


export default function AdminUsersPage() {
  const { db, functions } = useFirebase();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const [isBalanceDialogOpen, setIsBalanceDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [balanceAction, setBalanceAction] = useState<"add" | "remove">("add");
  const [balanceAmount, setBalanceAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isNotifDialogOpen, setIsNotifDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userNotifications, setUserNotifications] = useState<Notification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  
  const [isTransactionsDialogOpen, setIsTransactionsDialogOpen] = useState(false);
  const [userTransactions, setUserTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  const [isWithdrawnDialogOpen, setIsWithdrawnDialogOpen] = useState(false);
  const [withdrawnAction, setWithdrawnAction] = useState<"add" | "remove">("add");
  const [withdrawnAmount, setWithdrawnAmount] = useState("");

  const [isCpmCoinDialogOpen, setIsCpmCoinDialogOpen] = useState(false);
  const [cpmCoinAction, setCpmCoinAction] = useState<"add" | "remove">("add");
  const [cpmCoinAmount, setCpmCoinAmount] = useState("");
  
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [newTransactionDate, setNewTransactionDate] = useState<Date | undefined>(new Date());
  
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");


   useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    
    const unsubscribeUsers = onSnapshot(q, (querySnapshot) => {
        const usersDataPromises = querySnapshot.docs.map(async userDoc => {
            const user = { id: userDoc.id, ...userDoc.data() } as User;
            try {
                const coinDocRef = doc(db, "cpm_coins", user.id);
                const coinDoc = await getDoc(coinDocRef);
                user.cpmCoins = coinDoc.exists() ? coinDoc.data().amount : 0;
            } catch (error) {
                user.cpmCoins = 0;
            }
            return user;
        });

        Promise.all(usersDataPromises).then(usersData => {
            setUsers(usersData);
            setLoading(false);
        });

    }, (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch user data." });
    });

    return () => unsubscribeUsers();
  }, [db, toast]);

  useEffect(() => {
    if (viewingUser && db) {
        setLoadingNotifications(true);
        const q = query(collection(db, "users", viewingUser.id, "notifications"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const notifs: Notification[] = [];
            snapshot.forEach(doc => {
                notifs.push({ id: doc.id, ...doc.data() } as Notification);
            });
            setUserNotifications(notifs);
            setLoadingNotifications(false);
        });
        return () => unsubscribe();
    }
  }, [viewingUser, db]);
  
  useEffect(() => {
    if (viewingUser && isTransactionsDialogOpen && db) {
      setLoadingTransactions(true);
      
      const depositsQuery = query(collection(db, "deposits"), where("uid", "==", viewingUser.id));
      const withdrawalsQuery = query(collection(db, "withdrawals"), where("userId", "==", viewingUser.id));

      let deposits: Transaction[] = [];
      let withdrawals: Transaction[] = [];

      const unsubscribeDeposits = onSnapshot(depositsQuery, (snapshot) => {
          deposits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'deposit' } as Transaction));
          updateAllTransactions();
      });

      const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
          withdrawals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'withdrawal' } as Transaction));
          updateAllTransactions();
      });
      
      const updateAllTransactions = () => {
          const allTxs = [...deposits, ...withdrawals].sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
          setUserTransactions(allTxs);
          setLoadingTransactions(false);
      }

      return () => {
          unsubscribeDeposits();
          unsubscribeWithdrawals();
      }
    }
  }, [viewingUser, isTransactionsDialogOpen, db]);

  useEffect(() => {
    if (viewingUser && isTeamDialogOpen && db) {
        setLoadingTeam(true);
        const teamQuery = query(collection(db, "users"), where("referredBy", "==", viewingUser.id));
        const unsubscribe = onSnapshot(teamQuery, async (snapshot) => {
            const memberPromises = snapshot.docs.map(async (memberDoc) => {
                const member = { id: memberDoc.id, ...memberDoc.data() } as TeamMember;
                const coinDoc = await getDoc(doc(db, "cpm_coins", member.id));
                member.isVip = coinDoc.exists() && coinDoc.data().amount > 0;
                return member;
            });
            const members = await Promise.all(memberPromises);
            setTeamMembers(members);
            setLoadingTeam(false);
        });
        return () => unsubscribe();
    }
  }, [viewingUser, isTeamDialogOpen, db]);


  const openBalanceDialog = (user: User) => {
    setSelectedUser(user);
    setBalanceAmount("");
    setBalanceAction("add");
    setIsBalanceDialogOpen(true);
  };

  const openWithdrawnDialog = (user: User) => {
    setSelectedUser(user);
    setWithdrawnAmount("");
    setWithdrawnAction("add");
    setIsWithdrawnDialogOpen(true);
  };
  
  const openNotificationsDialog = (user: User) => {
    setViewingUser(user);
    setIsNotifDialogOpen(true);
  };

  const openTransactionsDialog = (user: User) => {
    setViewingUser(user);
    setIsTransactionsDialogOpen(true);
  };
  
  const openCpmCoinDialog = (user: User) => {
    setSelectedUser(user);
    setCpmCoinAmount("");
    setCpmCoinAction("add");
    setIsCpmCoinDialogOpen(true);
  };

  const openTeamDialog = (user: User) => {
    setViewingUser(user);
    setIsTeamDialogOpen(true);
  };
  
  const openEditTransactionDialog = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setNewTransactionDate(transaction.createdAt?.toDate() || new Date());
  };
  
  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmNewPassword("");
    setIsPasswordDialogOpen(true);
  };

  const updateUserStatus = async (userId: string, field: string, value: any) => {
    if (!db) return;

    const originalUsers = [...users];
    const fieldParts = field.split('.');
    setUsers(users.map(u => {
        if (u.id === userId) {
            let updatedUser = { ...u };
            let currentLevel: any = updatedUser;
            for (let i = 0; i < fieldParts.length - 1; i++) {
                currentLevel[fieldParts[i]] = { ...(currentLevel[fieldParts[i]] || {}) };
                currentLevel = currentLevel[fieldParts[i]];
            }
            currentLevel[fieldParts[fieldParts.length - 1]] = value;
            return updatedUser;
        }
        return u;
    }));
    
    try {
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, { [field]: value });
    } catch (error) {
      console.error(`Error updating user ${field}:`, error);
      setUsers(originalUsers);
      toast({
          variant: "destructive",
          title: "Update Failed",
          description: `Could not update user ${field}.`,
      });
    }
  };

  const handleToggleCommander = (user: User) => {
    if (!db) return;
    const newStatus = !user.isCommander;
    updateUserStatus(user.id, 'isCommander', newStatus).then(() => {
        const batch = writeBatch(db);
        const notifCollectionRef = collection(db, "users", user.id, "notifications");
        const notifMessage = newStatus 
            ? "Congratulations! You have been promoted to the rank of Commander. Check the Team page for your new benefits."
            : "You have been demoted from the rank of Commander.";

        batch.set(doc(notifCollectionRef), {
            userId: user.id, type: newStatus ? "success" : "warning", title: `Rank ${newStatus ? 'Promotion' : 'Demotion'}!`,
            message: notifMessage, status: "unread", seen: false, createdAt: serverTimestamp(),
        });

        const activityLogCollectionRef = collection(db, "activityLogs");
        batch.set(doc(activityLogCollectionRef), {
            userId: 'ADMIN', relatedUserId: user.id, action: `commander_status_${newStatus ? 'granted' : 'revoked'}`,
            details: `Admin ${newStatus ? 'promoted' : 'demoted'} ${user.email} to/from Commander.`, timestamp: serverTimestamp(),
        });

        batch.commit();
        toast({
            title: "Status Updated",
            description: `${user.name} is now ${newStatus ? 'a Commander' : 'not a Commander'}.`
        });
    });
  }

  const handleToggleWithdrawal = (user: User) => {
      if (!db) return;
      const newStatus = (user.withdrawalStatus === 'disabled') ? 'enabled' : 'disabled';
      updateUserStatus(user.id, 'withdrawalStatus', newStatus).then(() => {
        const batch = writeBatch(db);
        const notifCollectionRef = collection(db, "users", user.id, "notifications");
        batch.set(doc(notifCollectionRef), {
            userId: user.id, type: "admin", title: "Account Status Update",
            message: `An admin has ${newStatus} withdrawals for your account.`, status: "unread",
            seen: false, createdAt: serverTimestamp(), relatedId: user.id,
        });

        const activityLogCollectionRef = collection(db, "activityLogs");
        batch.set(doc(activityLogCollectionRef), {
            userId: 'ADMIN', relatedUserId: user.id, action: `withdrawal_status_${newStatus}`,
            details: `Admin set withdrawal status to ${newStatus} for ${user.email}.`, timestamp: serverTimestamp(),
        });
        batch.commit();
        toast({ title: "Status Updated", description: `${user.name}'s withdrawals are now ${newStatus}.` });
      });
  }

  const handleToggleCpmWithdrawal = (user: User) => {
      if (!db) return;
      const newStatus = (user.cpmWithdrawalStatus === 'disabled') ? 'enabled' : 'disabled';
      updateUserStatus(user.id, 'cpmWithdrawalStatus', newStatus).then(() => {
        const batch = writeBatch(db);
        const notifCollectionRef = collection(db, "users", user.id, "notifications");
        batch.set(doc(notifCollectionRef), {
            userId: user.id, type: "admin", title: "Account Status Update",
            message: `An admin has ${newStatus} CPM Coin withdrawals for your account.`, status: "unread",
            seen: false, createdAt: serverTimestamp(),
        });

        const activityLogCollectionRef = collection(db, "activityLogs");
        batch.set(doc(activityLogCollectionRef), {
            userId: 'ADMIN', relatedUserId: user.id, action: `cpm_withdrawal_status_${newStatus}`,
            details: `Admin set CPM Coin withdrawal status to ${newStatus} for ${user.email}.`, timestamp: serverTimestamp(),
        });
        batch.commit();
        toast({ title: "Status Updated", description: `${user.name}'s CPM Coin withdrawals are now ${newStatus}.` });
      });
  }

  const handleToggleTeamBonus = (user: User) => {
      if (!db) return;
      const newStatus = !user.teamBonusPaused;
      updateUserStatus(user.id, 'teamBonusPaused', newStatus).then(() => {
        const batch = writeBatch(db);
        const notifMessage = newStatus ? "An admin has paused team bonuses for your account." : "An admin has resumed team bonuses for your account.";
        const notifCollectionRef = collection(db, "users", user.id, "notifications");
        batch.set(doc(notifCollectionRef), {
            userId: user.id, type: "admin", title: "Team Bonus Status Update", message: notifMessage,
            status: "unread", seen: false, createdAt: serverTimestamp(),
        });
        const activityLogCollectionRef = collection(db, "activityLogs");
        batch.set(doc(activityLogCollectionRef), {
            userId: 'ADMIN', relatedUserId: user.id, action: `team_bonus_status_${newStatus ? 'paused' : 'resumed'}`,
            details: `Admin set team bonus status to ${newStatus ? 'paused' : 'resumed'} for ${user.email}.`, timestamp: serverTimestamp(),
        });
        batch.commit();
        toast({ title: "Status Updated", description: `${user.name}'s team bonuses are now ${newStatus ? 'paused' : 'active'}.` });
      });
  }

  const handleToggleWithdrawalVerification = async (user: User) => {
    if(!db) return;
    const currentStatus = user.withdrawalVerification?.required || false;
    const newRequiredStatus = !currentStatus;
    
    try {
        const userDocRef = doc(db, 'users', user.id);
        const updatePayload = {
            'withdrawalVerification.required': newRequiredStatus,
            'withdrawalVerification.status': newRequiredStatus ? (user.withdrawalVerification?.status === 'verified' ? 'verified' : 'not_verified') : 'not_verified'
        };
        await updateDoc(userDocRef, updatePayload);
        toast({
            title: 'Security Updated',
            description: `Withdrawal verification for ${user.name} is now ${newRequiredStatus ? 'ENABLED' : 'DISABLED'}.`
        });
    } catch (error) {
        console.error("Error toggling verification", error);
        toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleResetVerification = (user: User) => {
    if(!db) return;
    const updatePayload = {
      'withdrawalVerification.status': 'not_verified',
      'withdrawalVerification.attempts': 0,
      'withdrawalVerification.cooldownUntil': null,
      'withdrawalVerification.otp': null,
    };
     try {
        const userDocRef = doc(db, 'users', user.id);
        updateDoc(userDocRef, updatePayload);
        toast({
            title: 'Verification Reset',
            description: `The verification status and attempts for ${user.name} have been reset.`
        });
    } catch (error) {
        console.error("Error resetting verification", error);
        toast({ variant: 'destructive', title: 'Update Failed' });
    }
  };

  const handleManualVerify = (user: User) => {
    if(!db) return;
    const updatePayload = {
      'withdrawalVerification.status': 'verified',
      'withdrawalVerification.attempts': 0,
      'withdrawalVerification.cooldownUntil': null,
      'withdrawalVerification.otp': null,
    };
      try {
        const userDocRef = doc(db, 'users', user.id);
        updateDoc(userDocRef, updatePayload);
        toast({
            title: 'User Verified',
            description: `${user.name} has been manually verified for withdrawals.`
        });
    } catch (error) {
        console.error("Error manually verifying", error);
        toast({ variant: 'destructive', title: 'Update Failed' });
    }
  }

  const handleBalanceUpdate = async () => {
    if (!selectedUser || !balanceAmount || !db) return;

    const amount = parseFloat(balanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive number." });
      return;
    }

    setIsSubmitting(true);
    try {
      const userDocRef = doc(db, "users", selectedUser.id);
      const currentDoc = await getDoc(userDocRef);
      const currentBalance = currentDoc.data()?.balance0 ?? 0;

      if (balanceAction === 'remove' && amount > currentBalance) {
          toast({ variant: "destructive", title: "Insufficient Balance", description: `Cannot remove ${amount} Points. User balance is ${currentBalance.toFixed(2)} Points.` });
          setIsSubmitting(false); return;
      }
      const incrementValue = balanceAction === "add" ? amount : -amount;
      const batch = writeBatch(db);
      batch.update(userDocRef, { balance0: increment(incrementValue) });

      const notifCollectionRef = collection(db, "users", selectedUser.id, "notifications");
      batch.set(doc(notifCollectionRef), {
          userId: selectedUser.id, type: "admin", title: "Balance Update",
          message: `An admin has ${balanceAction === 'add' ? 'added' : 'removed'} ${amount.toFixed(2)} Points ${balanceAction === 'add' ? 'to' : 'from'} your account.`,
          amount: amount, status: "unread", seen: false, createdAt: serverTimestamp(), relatedId: selectedUser.id,
      });

      const activityLogCollectionRef = collection(db, "activityLogs");
      batch.set(doc(activityLogCollectionRef), {
          userId: 'ADMIN', relatedUserId: selectedUser.id, action: `balance_${balanceAction}`,
          details: `Admin ${balanceAction} ${amount.toFixed(2)} Points to/from balance for ${selectedUser.email}.`, timestamp: serverTimestamp(),
      });
      await batch.commit();
      toast({ title: "Balance Updated", description: `Successfully updated ${selectedUser.name}'s balance.` });
      setIsBalanceDialogOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update user balance." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawnUpdate = async () => {
    if (!selectedUser || !withdrawnAmount || !db) return;
    const amount = parseFloat(withdrawnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive number." });
      return;
    }
    setIsSubmitting(true);
    const userDocRef = doc(db, "users", selectedUser.id);
    try {
        const currentDoc = await getDoc(userDocRef);
        const currentWithdrawn = currentDoc.data()?.totalWithdrawn ?? 0;

        if (withdrawnAction === 'remove' && amount > currentWithdrawn) {
            toast({ variant: "destructive", title: "Insufficient Amount", description: `Cannot remove ${amount} Points. User total withdrawn is ${currentWithdrawn.toFixed(2)} Points.` });
            setIsSubmitting(false); return;
        }
        const incrementValue = withdrawnAction === "add" ? amount : -amount;
        await updateDoc(userDocRef, { totalWithdrawn: increment(incrementValue) });
        toast({ title: "Total Withdrawn Updated", description: `Successfully updated ${selectedUser.name}'s total withdrawn amount.` });
        setIsWithdrawnDialogOpen(false);
    } catch(error) {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update user's total withdrawn amount." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleRemoveAllBalance = async () => {
    if (!selectedUser || !db) return;
    setIsSubmitting(true);
    try {
        const userDocRef = doc(db, "users", selectedUser.id);
        const currentDoc = await getDoc(userDocRef);
        const removedAmount = currentDoc.data()?.balance0 ?? 0;
        if (removedAmount === 0) {
            toast({ title: "No action needed", description: "User balance is already zero." });
            setIsSubmitting(false); return;
        }
        const batch = writeBatch(db);
        batch.update(userDocRef, { balance0: 0 });
        const notifCollectionRef = collection(db, "users", selectedUser.id, "notifications");
        batch.set(doc(notifCollectionRef), {
            userId: selectedUser.id, type: "admin", title: "Balance Cleared", message: `An admin has cleared your account balance of ${removedAmount.toFixed(2)} Points.`,
            amount: removedAmount, status: "unread", seen: false, createdAt: serverTimestamp(), relatedId: selectedUser.id,
        });
        const activityLogCollectionRef = collection(db, "activityLogs");
        batch.set(doc(activityLogCollectionRef), {
            userId: selectedUser.id, action: 'balance_cleared', details: `Admin cleared balance of ${removedAmount.toFixed(2)} Points.`, timestamp: serverTimestamp(),
        });
        await batch.commit();
        toast({ title: "Balance Cleared", description: `Successfully removed all balance for ${selectedUser.name}.` });
        setIsBalanceDialogOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Action Failed", description: "Could not clear user balance." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleResetTotalWithdrawn = async () => {
    if (!selectedUser || !db) return;
    setIsSubmitting(true);
    const userDocRef = doc(db, "users", selectedUser.id);
    try {
        await updateDoc(userDocRef, { totalWithdrawn: 0 });
        toast({ title: "Total Withdrawn Reset", description: `Successfully reset total withdrawn for ${selectedUser.name}.` });
        setIsWithdrawnDialogOpen(false);
    } catch(error) {
        toast({ variant: "destructive", title: "Action Failed", description: "Could not reset user's total withdrawn amount." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeleteNotification = (notifId: string) => {
    if(!viewingUser || !db) return;
    const notifDocRef = doc(db, "users", viewingUser.id, "notifications", notifId);
    deleteDoc(notifDocRef).then(() => {
        toast({ title: "Notification Deleted" });
    }).catch(error => {
        toast({ variant: "destructive", title: "Deletion Failed" });
    });
  }

  const handleDeleteAllNotifications = async () => {
    if (!viewingUser || !db) return;
    const notificationsCollectionRef = collection(db, "users", viewingUser.id, "notifications");
    try {
        const querySnapshot = await getDocs(notificationsCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No notifications to delete." });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "All Notifications Deleted", description: `Removed all notifications for ${viewingUser.name}.` });
    } catch (error) {
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all notifications." });
    }
  };
  
  const handleDeleteTransaction = (tx: Transaction) => {
    if(!viewingUser || !db) return;
    const collectionName = tx.type === 'deposit' ? 'deposits' : 'withdrawals';
    const txDocRef = doc(db, collectionName, tx.id);
    deleteDoc(txDocRef).then(() => {
        toast({ title: "Transaction Deleted" });
    }).catch(error => {
        toast({ variant: "destructive", title: "Deletion Failed" });
    });
  };

  const handleUpdateTransactionDate = async () => {
    if (!editingTransaction || !newTransactionDate || !db) return;
    setIsSubmitting(true);
    const collectionName = editingTransaction.type === 'deposit' ? 'deposits' : 'withdrawals';
    const txDocRef = doc(db, collectionName, editingTransaction.id);
    try {
        await updateDoc(txDocRef, { createdAt: Timestamp.fromDate(newTransactionDate) });
        toast({ title: "Transaction Updated", description: "The transaction date has been successfully updated." });
        setEditingTransaction(null);
    } catch (error) {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update the transaction date." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCpmCoinUpdate = async () => {
    if (!selectedUser || !cpmCoinAmount || !db) return;
    const amount = parseInt(cpmCoinAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Invalid Amount", description: "Please enter a valid positive whole number." });
      return;
    }
    setIsSubmitting(true);
    const coinDocRef = doc(db, "cpm_coins", selectedUser.id);
    try {
        const coinDoc = await getDoc(coinDocRef);
        const currentCoins = coinDoc.exists() ? coinDoc.data().amount || 0 : 0;
        if (cpmCoinAction === 'remove' && amount > currentCoins) {
            toast({ variant: "destructive", title: "Insufficient Coins", description: `Cannot remove ${amount} coins. User only has ${currentCoins}.` });
            setIsSubmitting(false); return;
        }
        const incrementValue = cpmCoinAction === 'add' ? amount : -amount;
        const batch = writeBatch(db);
        batch.set(coinDocRef, { 
            amount: increment(incrementValue), userId: selectedUser.id, lastUpdatedAt: serverTimestamp(),
        }, { merge: true });
        const notifRef = doc(collection(db, "users", selectedUser.id, "notifications"));
        batch.set(notifRef, {
            userId: selectedUser.id, type: 'admin', title: 'CPM Coin Balance Update',
            message: `An admin ${cpmCoinAction}ed ${amount} CPM Coin(s) ${cpmCoinAction === 'add' ? 'to' : 'from'} your account.`,
            amount: amount, status: 'unread', seen: false, createdAt: serverTimestamp(),
        });
        await batch.commit();
        toast({ title: "CPM Coins Updated", description: `Successfully updated ${selectedUser.name}'s coin balance.` });
        setIsCpmCoinDialogOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Update Failed", description: "Could not update user's coin balance." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleRemoveAllCpmCoins = async () => {
    if (!selectedUser || !db) return;
    setIsSubmitting(true);
    const coinDocRef = doc(db, "cpm_coins", selectedUser.id);
    try {
        await updateDoc(coinDocRef, { amount: 0 });
        toast({ title: "All CPM Coins Removed", description: `Successfully removed all coins for ${selectedUser.name}.` });
        setIsCpmCoinDialogOpen(false);
    } catch (error) {
        toast({ variant: "destructive", title: "Action Failed", description: "Could not remove user's coins. They may not have any." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleChangePassword = async () => {
    if (!selectedUser || !newPassword || !functions) return;
    if (newPassword.length < 6) {
        toast({ variant: "destructive", title: "Password Too Short", description: "Password must be at least 6 characters." });
        return;
    }
    if (newPassword !== confirmNewPassword) {
        toast({ variant: "destructive", title: "Passwords Do Not Match" });
        return;
    }
    setIsSubmitting(true);
    const changeUserPassword = httpsCallable(functions, 'changeUserPassword');
    try {
        await changeUserPassword({ uid: selectedUser.id, password: newPassword });
        toast({ title: "Password Updated", description: `Password for ${selectedUser.email} has been changed.` });
        setIsPasswordDialogOpen(false);
    } catch (error: any) {
        console.error("Password change failed:", error);
        toast({ variant: "destructive", title: "Update Failed", description: error.message || "Could not change the password." });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const getUserBalance = (user: User) => {
    return user.balance0 ?? user.balance ?? 0;
  }
  
  const getStatusVariant = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return 'secondary';
    if (s === 'approved' || s === 'sent') return 'default';
    if (s === 'rejected' || s === 'failed') return 'destructive';
    return 'secondary';
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-white font-bold">
                <Users />
                Manage Users
              </CardTitle>
              <CardDescription>
                View and manage all registered users.
              </CardDescription>
            </div>
            <Input
              placeholder="Search by name, email or phone..."
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
                  <TableHead>Details</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status Controls</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground break-all">{user.email}</div>
                       <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {user.isCommander && 
                          <Badge className="bg-gradient-to-br from-yellow-400 to-amber-500 text-black border-yellow-600 text-xs shadow-lg shadow-amber-500/40">
                              <Star className="h-3 w-3 mr-1 text-black"/> Commander
                          </Badge>
                        }
                        {user.cpmCoins && user.cpmCoins > 0 && !user.isCommander &&
                          <Badge className="bg-gradient-to-br from-purple-600 to-indigo-700 text-yellow-300 border-purple-400 text-xs shadow-lg shadow-purple-500/20">
                              <ShieldCheck className="h-3 w-3 mr-1 text-yellow-400"/> VIP
                          </Badge>
                        }
                        {user.customBadges?.map(badge => (
                          <Badge key={badge.id} style={{ backgroundColor: badge.color }} className="text-white">
                              {badge.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">Balance: <span className="font-bold">${getUserBalance(user).toFixed(2)}</span></div>
                      <div className="text-xs text-muted-foreground">Team: <span className="font-bold">{user.totalTeamMembers || 0}</span></div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : "N/A"}
                    </TableCell>
                    <TableCell>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            <div className="flex items-center gap-2">
                                <Switch id={`withdrawal-switch-${user.id}`} checked={user.withdrawalStatus !== 'disabled'} onCheckedChange={() => handleToggleWithdrawal(user)} />
                                <Label htmlFor={`withdrawal-switch-${user.id}`} className="text-xs">Withdrawal</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id={`cpm-withdrawal-switch-${user.id}`} checked={user.cpmWithdrawalStatus !== 'disabled'} onCheckedChange={() => handleToggleCpmWithdrawal(user)} />
                                <Label htmlFor={`cpm-withdrawal-switch-${user.id}`} className="text-xs">CPM Withdraw</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch id={`bonus-switch-${user.id}`} checked={!user.teamBonusPaused} onCheckedChange={() => handleToggleTeamBonus(user)} />
                                <Label htmlFor={`bonus-switch-${user.id}`} className="text-xs">Team Bonus</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                 <Button size="sm" variant={user.isCommander ? 'destructive' : 'outline'} onClick={() => handleToggleCommander(user)} className="text-xs h-6 px-2">
                                    {user.isCommander ? 'Revoke' : 'Grant'} Commander
                                </Button>
                            </div>
                            <div className="flex items-center gap-2 col-span-2">
                               <Switch id={`otp-switch-${user.id}`} checked={user.withdrawalVerification?.required} onCheckedChange={() => handleToggleWithdrawalVerification(user)} />
                                <Label htmlFor={`otp-switch-${user.id}`} className="text-xs flex items-center gap-1">
                                    OTP Verification 
                                    <Badge variant={
                                        user.withdrawalVerification?.status === 'verified' ? 'default' :
                                        user.withdrawalVerification?.status === 'locked' ? 'destructive' : 'secondary'
                                    } className="capitalize text-xs px-1.5 py-0">
                                      {user.withdrawalVerification?.status?.replace('_', ' ') || 'N/A'}
                                    </Badge>
                                </Label>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className="text-right">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>User Info</DropdownMenuLabel>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2 cursor-default focus:bg-background">
                                  <Wifi size={14}/> <span>{user.ipAddress || 'N/A'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="flex items-center gap-2 cursor-default focus:bg-background text-xs">
                                  <Monitor size={14}/> <span className="truncate max-w-48">{user.deviceInfo || 'N/A'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openPasswordDialog(user)}>
                                  <KeyRound className="mr-2 h-4 w-4" />
                                  Change Password
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Edit Funds</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => openBalanceDialog(user)}>Balance</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openWithdrawnDialog(user)}>Total Withdrawn</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openCpmCoinDialog(user)}>CPM Coins</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>View History</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => openNotificationsDialog(user)}>Notifications</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openTransactionsDialog(user)}>Transactions</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                 <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Verification</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuItem onClick={() => handleManualVerify(user)}>Manual Verify</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleResetVerification(user)}>Reset Attempts/Lock</DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuItem onClick={() => openTeamDialog(user)}>View Team</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredUsers.length === 0 && (
            <p className="text-center text-foreground mt-4 py-8">
              No users found.
            </p>
          )}
        </CardContent>
      </Card>
      {/* Dialogs */}
      <Dialog open={isBalanceDialogOpen} onOpenChange={setIsBalanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Balance for {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Current Balance: ${(selectedUser ? (getUserBalance(selectedUser)) : 0).toFixed(2)} Points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={balanceAction === "add" ? "default" : "outline"}
                onClick={() => setBalanceAction("add")}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                variant={balanceAction === "remove" ? "destructive" : "outline"}
                onClick={() => setBalanceAction("remove")}
                 className="flex-1"
              >
                Remove
              </Button>
            </div>
            <div>
              <Label htmlFor="balance-amount">Amount</Label>
              <Input
                id="balance-amount"
                type="number"
                value={balanceAmount}
                onChange={(e) => setBalanceAmount(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isSubmitting}>Remove All Balance</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will set {selectedUser?.name}'s balance to 0 Points. This action is irreversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveAllBalance} className="bg-destructive hover:bg-destructive/90">
                           Yes, Remove All Balance
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsBalanceDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleBalanceUpdate} disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Update Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isWithdrawnDialogOpen} onOpenChange={setIsWithdrawnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Total Withdrawn for {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Current Total Withdrawn: {(selectedUser?.totalWithdrawn ?? 0).toFixed(2)} Points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={withdrawnAction === "add" ? "default" : "outline"}
                onClick={() => setWithdrawnAction("add")}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                variant={withdrawnAction === "remove" ? "destructive" : "outline"}
                onClick={() => setWithdrawnAction("remove")}
                 className="flex-1"
              >
                Remove
              </Button>
            </div>
            <div>
              <Label htmlFor="withdrawn-amount">Amount</Label>
              <Input
                id="withdrawn-amount"
                type="number"
                value={withdrawnAmount}
                onChange={(e) => setWithdrawnAmount(e.target.value)}
                placeholder="e.g. 50"
              />
            </div>
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isSubmitting}>Reset Total Withdrawn</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reset {selectedUser?.name}'s total withdrawn amount to 0 Points. This action is irreversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleResetTotalWithdrawn} className="bg-destructive hover:bg-destructive/90">
                           Yes, Reset Amount
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsWithdrawnDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleWithdrawnUpdate} disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Update Amount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCpmCoinDialogOpen} onOpenChange={setIsCpmCoinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit CPM Coins for {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Current Coins: {selectedUser?.cpmCoins || 0}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-4">
              <Button
                variant={cpmCoinAction === "add" ? "default" : "outline"}
                onClick={() => setCpmCoinAction("add")}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                variant={cpmCoinAction === "remove" ? "destructive" : "outline"}
                onClick={() => setCpmCoinAction("remove")}
                 className="flex-1"
              >
                Remove
              </Button>
            </div>
            <div>
              <Label htmlFor="coin-amount">Amount</Label>
              <Input
                id="coin-amount"
                type="number"
                value={cpmCoinAmount}
                onChange={(e) => setCpmCoinAmount(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
             <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" disabled={isSubmitting}>Remove All Coins</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will set {selectedUser?.name}'s CPM Coin balance to 0. This action is irreversible.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemoveAllCpmCoins} className="bg-destructive hover:bg-destructive/90">
                           Yes, Remove All Coins
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setIsCpmCoinDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleCpmCoinUpdate} disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Update Coins
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isNotifDialogOpen} onOpenChange={setIsNotifDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                 <DialogTitle>Notifications for {viewingUser?.name}</DialogTitle>
                <DialogDescription>
                  Viewing all notifications for {viewingUser?.email}.
                </DialogDescription>
              </div>
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm" disabled={userNotifications.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete All
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Delete all notifications?</AlertDialogTitle>
                          <AlertDialogDescription>
                              This will permanently delete all {userNotifications.length} notifications for {viewingUser?.name}. This action is irreversible.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllNotifications} className="bg-destructive hover:bg-destructive/90">
                            Yes, Delete All
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
             {loadingNotifications ? <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto"/></div> : (
                userNotifications.length === 0 
                ? <p className="text-center text-muted-foreground p-4">No notifications found for this user.</p>
                : userNotifications.map(notif => (
                    <div key={notif.id} className="border rounded-md p-3 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Badge className={cn(typeColors[notif.type] || "bg-gray-500", "text-white")}>{notif.type}</Badge>
                                <h3 className="font-semibold text-white">{notif.title}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-2">{notif.createdAt?.toDate().toLocaleString()}</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                               <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Notification?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                      Are you sure you want to delete this notification?
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteNotification(notif.id)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                              </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))
             )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTransactionsDialogOpen} onOpenChange={setIsTransactionsDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
           <DialogHeader>
              <DialogTitle>Transactions for {viewingUser?.name}</DialogTitle>
              <DialogDescription>
                Viewing all transactions for {viewingUser?.email}.
              </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
             {loadingTransactions ? <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto"/></div> : (
                userTransactions.length === 0 
                ? <p className="text-center text-muted-foreground p-4">No transactions found for this user.</p>
                : (
                   <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {userTransactions.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>
                                <Badge variant={tx.type === 'deposit' ? 'default' : 'destructive'} className="capitalize">{tx.type}</Badge>
                            </TableCell>
                            <TableCell>{tx.amount.toFixed(2)} Points</TableCell>
                            <TableCell>
                                <Badge variant={getStatusVariant(tx.status)} className="capitalize">{tx.status}</Badge>
                            </TableCell>
                            <TableCell>{tx.createdAt ? tx.createdAt.toDate().toLocaleString() : "N/A"}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => openEditTransactionDialog(tx)}>
                                  <Edit className="h-4 w-4"/>
                                </Button>
                               <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete this {tx.type} transaction of {tx.amount} Points? This is irreversible.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTransaction(tx)} className="bg-destructive hover:bg-destructive/90">
                                          Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                   </Table>
                )
             )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!editingTransaction} onOpenChange={() => setEditingTransaction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Transaction Time</DialogTitle>
            <DialogDescription>
              Change the date and time for this transaction. Original: {editingTransaction?.createdAt ? editingTransaction.createdAt.toDate().toLocaleString() : "N/A"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
              <div className="space-y-2">
                  <Label>New Date & Time</Label>
                  <div className="flex gap-2">
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !newTransactionDate && "text-muted-foreground")}>
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {newTransactionDate ? format(newTransactionDate, "PPP") : <span>Pick a date</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                          <Calendar
                              mode="single"
                              selected={newTransactionDate}
                              onSelect={(date) => {
                                  if (!date) return;
                                  const newDate = new Date(newTransactionDate || Date.now());
                                  newDate.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
                                  setNewTransactionDate(newDate);
                              }}
                              initialFocus
                          />
                      </PopoverContent>
                  </Popover>
                  <Input 
                      type="time" 
                      value={newTransactionDate ? format(newTransactionDate, "HH:mm") : ""}
                      onChange={(e) => {
                          const [hours, minutes] = e.target.value.split(':').map(Number);
                          const newDate = new Date(newTransactionDate || Date.now());
                          newDate.setHours(hours, minutes);
                          setNewTransactionDate(newDate);
                      }}
                      className="w-[120px]"
                  />
                  </div>
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTransaction(null)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleUpdateTransactionDate} disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <div>
                 <DialogTitle>Team Members for {viewingUser?.name}</DialogTitle>
                <DialogDescription>
                  Viewing all users referred by {viewingUser?.email}.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2 p-1">
             {loadingTeam ? <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto"/></div> : (
                teamMembers.length === 0 
                ? <p className="text-center text-muted-foreground p-4">This user has not referred anyone.</p>
                : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Joined</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {teamMembers.map(member => (
                                <TableRow key={member.id} className={cn(member.isVip && "bg-purple-900/20")}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {member.name}
                                        {member.isVip && 
                                            <Badge className="bg-gradient-to-br from-purple-600 to-indigo-700 text-yellow-300 border-purple-400 shadow-lg shadow-purple-500/20">
                                                <ShieldCheck className="h-3 w-3 mr-1 text-yellow-400"/> VIP
                                            </Badge>
                                        }
                                      </div>
                                    </TableCell>
                                    <TableCell>{member.email}</TableCell>
                                    <TableCell>{member.createdAt?.toDate().toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )
             )}
          </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password for {selectedUser?.name}</DialogTitle>
            <DialogDescription>
              Enter a new password for {selectedUser?.email}. The user will be notified of this change.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
             <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
