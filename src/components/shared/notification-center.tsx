
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { collection, query, onSnapshot, orderBy, Timestamp, doc, writeBatch } from "firebase/firestore";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Bell, Info, AlertTriangle, CheckCircle, XCircle, Gift, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirebase } from "@/lib/firebase/provider";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "alert" | "deposit" | "withdraw" | "plan" | "profit" | "admin";
  seen: boolean;
  createdAt: Timestamp;
}

const typeStyles = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10" },
  success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  alert: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
  deposit: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  withdraw: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" }, // Using Check for approved
  plan: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  profit: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  admin: { icon: Award, color: "text-primary", bg: "bg-primary/10" },
};

export default function NotificationCenter() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const [personalNotifications, setPersonalNotifications] = useState<Notification[]>([]);
  const [globalNotifications, setGlobalNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !db) return;
    
    // Listener for user-specific notifications
    const personalQuery = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc")
    );
    const unsubscribePersonal = onSnapshot(personalQuery, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      setPersonalNotifications(notifs);
    });

    // Listener for global announcements
    const globalQuery = query(
      collection(db, "announcements"),
      orderBy("createdAt", "desc")
    );
    const unsubscribeGlobal = onSnapshot(globalQuery, (snapshot) => {
      const notifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: doc.data().type || 'info' } as Notification));
      setGlobalNotifications(notifs);
    });

    return () => {
      unsubscribePersonal();
      unsubscribeGlobal();
    };
    
  }, [user, db]);

  // Combine and sort all notifications
  const allNotifications = useMemo(() => {
    return [...personalNotifications, ...globalNotifications].sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
    });
  }, [personalNotifications, globalNotifications]);

  const unreadCount = useMemo(() => {
    // Only personal notifications can be "unread"
    return personalNotifications.filter(n => !n.seen).length;
  }, [personalNotifications]);


  const markAllAsRead = async () => {
    if (unreadCount > 0 && user && db) {
        const batch = writeBatch(db);
        personalNotifications.forEach(notif => {
            if (!notif.seen) {
            const notifRef = doc(db, "users", user.uid, "notifications", notif.id);
            batch.update(notifRef, { seen: true });
            }
        });
        await batch.commit().catch(console.error);
    }
  }
  
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white animate-pulse">
              {unreadCount}
            </span>
          )}
          <span className="sr-only">Toggle notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-md bg-muted/20 p-0 flex flex-col border-border/40 backdrop-blur-xl">
        <SheetHeader className="p-4 border-b border-border/40 flex flex-row items-center justify-between">
          <SheetTitle className="text-xl font-bold text-white">Notifications</SheetTitle>
           {unreadCount > 0 && (
            <Button variant="link" size="sm" onClick={markAllAsRead} className="text-primary">
              Mark all as read
            </Button>
          )}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {allNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-4">
                <Bell className="h-12 w-12 mb-4"/>
                <p className="font-semibold text-white">No notifications yet</p>
                <p className="text-sm">We'll let you know when something new comes up.</p>
            </div>
          ) : (
            allNotifications.map((notif) => {
              const styles = typeStyles[notif.type] || typeStyles.info;
              const Icon = styles.icon;
              const isUnread = personalNotifications.some(p => p.id === notif.id && !p.seen);

              return (
                <div
                    key={notif.id}
                    className={cn(
                        "rounded-lg border bg-background/40 border-border/30 p-4 transition-colors hover:bg-primary/5",
                    )}
                    >
                    <div className="flex items-start gap-4">
                        <div className={cn("p-2 rounded-full", styles.bg)}>
                            <Icon className={cn("h-5 w-5", styles.color)} />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <p className="font-bold text-white">{notif.title}</p>
                                {isUnread && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                            <p className="text-xs text-muted-foreground mt-3">
                                {notif.createdAt?.toDate().toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
              );
            })
          )}
        </div>
         {allNotifications.length > 0 && (
            <SheetFooter className="p-4 border-t border-border/40">
                <p className="text-xs text-center text-muted-foreground">You've reached the end of your notifications.</p>
            </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
