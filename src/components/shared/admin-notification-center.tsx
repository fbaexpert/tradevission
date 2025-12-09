
"use client";

import { useEffect, useState, useMemo } from "react";
import { collection, query, onSnapshot, where, Timestamp, writeBatch, doc } from "firebase/firestore";
import Link from 'next/link';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, LifeBuoy, Lightbulb, ArrowDownToDot, ArrowUpFromDot, Coins, KeyRound, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirebase } from "@/lib/firebase/provider";
import { useToast } from "@/hooks/use-toast";


interface NotificationItem {
  id: string;
  type: 'ticket' | 'feedback' | 'deposit' | 'withdrawal' | 'cpm_withdrawal' | 'vip_code_earned';
  message: string;
  link?: string;
  createdAt: Timestamp;
  status: 'new' | 'viewed';
}

const typeStyles = {
  ticket: { icon: LifeBuoy, color: "text-blue-500", title: "New Support Ticket" },
  feedback: { icon: Lightbulb, color: "text-yellow-500", title: "New Feedback" },
  deposit: { icon: ArrowDownToDot, color: "text-green-500", title: "New Deposit Request" },
  withdrawal: { icon: ArrowUpFromDot, color: "text-red-500", title: "New Withdrawal Request" },
  cpm_withdrawal: { icon: Coins, color: "text-amber-500", title: "New CPM Withdrawal" },
  vip_code_earned: { icon: KeyRound, color: "text-purple-400", title: "User Earned VIP Code" },
};

export default function AdminNotificationCenter() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<NotificationItem[]>([]);
  const [feedback, setFeedback] = useState<NotificationItem[]>([]);
  const [deposits, setDeposits] = useState<NotificationItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<NotificationItem[]>([]);
  const [cpmWithdrawals, setCpmWithdrawals] = useState<NotificationItem[]>([]);
  const [adminAlerts, setAdminAlerts] = useState<NotificationItem[]>([]);

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!db) return;

    const ticketsQuery = query(collection(db, "supportTickets"), where("status", "==", "pending"));
    const unsubscribeTickets = onSnapshot(ticketsQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id, type: 'ticket' as const, message: `From: ${doc.data().userName} - ${doc.data().subject}`,
        link: '/admin/support', createdAt: doc.data().createdAt, status: 'new' as const
      }));
      setTickets(items);
    });
    
    const feedbackQuery = query(collection(db, "feedback"), where("status", "==", "submitted"));
    const unsubscribeFeedback = onSnapshot(feedbackQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id, type: 'feedback' as const, message: `From: ${doc.data().userName} - ${doc.data().category.replace('_', ' ')}`,
        link: '/admin/feedback', createdAt: doc.data().createdAt, status: 'new' as const
      }));
      setFeedback(items);
    });

    const depositsQuery = query(collection(db, "deposits"), where("status", "==", "pending"));
    const unsubscribeDeposits = onSnapshot(depositsQuery, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id, type: 'deposit' as const, message: `From: ${doc.data().email} - $${doc.data().amount.toFixed(2)}`,
            link: '/admin/deposits', createdAt: doc.data().createdAt, status: 'new' as const
        }));
        setDeposits(items);
    });

    const withdrawalsQuery = query(collection(db, "withdrawals"), where("status", "==", "pending"));
    const unsubscribeWithdrawals = onSnapshot(withdrawalsQuery, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id, type: 'withdrawal' as const, message: `From: ${doc.data().userEmail} - $${doc.data().amount.toFixed(2)}`,
            link: '/admin/withdrawals', createdAt: doc.data().createdAt, status: 'new' as const
        }));
        setWithdrawals(items);
    });
    
    const cpmWithdrawalsQuery = query(collection(db, "cpmWithdrawals"), where("status", "==", "pending"));
    const unsubscribeCpmWithdrawals = onSnapshot(cpmWithdrawalsQuery, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id, type: 'cpm_withdrawal' as const, message: `From: ${doc.data().userEmail} - ${doc.data().amount} CPM`,
            link: '/admin/cpm-withdrawals', createdAt: doc.data().createdAt, status: 'new' as const
        }));
        setCpmWithdrawals(items);
    });

    const adminAlertsQuery = query(collection(db, "adminAlerts"), where("status", "==", "new"));
    const unsubscribeAdminAlerts = onSnapshot(adminAlertsQuery, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id, type: 'vip_code_earned' as const, message: doc.data().message,
            createdAt: doc.data().createdAt, status: 'new' as const
        }));
        setAdminAlerts(items);
    });

    return () => {
      unsubscribeTickets();
      unsubscribeFeedback();
      unsubscribeDeposits();
      unsubscribeWithdrawals();
      unsubscribeCpmWithdrawals();
      unsubscribeAdminAlerts();
    };
    
  }, [db]);

  const handleMarkAsDone = async (alertId: string) => {
    if (!db) return;
    const alertRef = doc(db, 'adminAlerts', alertId);
    await writeBatch(db).update(alertRef, { status: 'viewed' }).commit();
    toast({ title: "Alert Marked as Done", description: "You can dismiss this alert now." });
  };

  const allNotifications = useMemo(() => {
    return [...tickets, ...feedback, ...deposits, ...withdrawals, ...cpmWithdrawals, ...adminAlerts].sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
    });
  }, [tickets, feedback, deposits, withdrawals, cpmWithdrawals, adminAlerts]);

  const totalCount = allNotifications.length;

  const NotificationLink = ({ notif, children }: { notif: NotificationItem, children: React.ReactNode }) => {
    if (notif.link) {
      return <Link href={notif.link} onClick={() => setIsOpen(false)} className="flex-1">{children}</Link>;
    }
    return <div className="flex-1">{children}</div>;
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {totalCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white animate-pulse">
              {totalCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md bg-muted/20 p-0 flex flex-col border-border/40 backdrop-blur-xl">
        <SheetHeader className="p-4 border-b border-border/40">
          <SheetTitle className="text-xl font-bold text-white">Admin Alerts</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <Bell className="h-12 w-12 mb-4"/>
                <p className="font-semibold text-white">All Clear!</p>
                <p className="text-sm">No pending actions requiring your attention.</p>
            </div>
          ) : (
            allNotifications.map((notif) => {
              const styles = typeStyles[notif.type];
              const Icon = styles.icon;
              return (
                <div key={notif.id} className="rounded-lg border bg-background/40 border-border/30 p-4 transition-colors hover:bg-primary/10 relative group">
                  <div className="flex items-start gap-4">
                      <Icon className={cn("h-5 w-5 mt-0.5 flex-shrink-0", styles.color)} />
                      <NotificationLink notif={notif}>
                          <p className="font-bold text-white">{styles.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                          <p className="text-xs text-muted-foreground mt-3">
                              {notif.createdAt?.toDate().toLocaleString()}
                          </p>
                      </NotificationLink>
                      {notif.type === 'vip_code_earned' && (
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => handleMarkAsDone(notif.id)}>
                             <CheckCircle className="mr-1.5 h-3 w-3 text-green-500"/> Mark as Done
                          </Button>
                      )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
