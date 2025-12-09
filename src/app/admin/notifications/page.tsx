
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  where,
  getDocs,
  Timestamp,
  doc,
  writeBatch,
  deleteDoc
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, LoaderCircle, Users, User, Check, ChevronsUpDown, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { Form, FormField, FormItem } from "@/components/ui/form";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useFirebase } from "@/lib/firebase/provider";
import { useIsMobile } from "@/hooks/use-mobile";


const notificationSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters long"),
  message: z.string().min(10, "Message must be at least 10 characters long"),
  type: z.enum(["info", "success", "warning", "alert"]),
  target: z.enum(["all", "single"]),
  targetIdentifier: z.string().optional(),
}).refine(data => data.target !== 'single' || (data.target === 'single' && data.targetIdentifier && data.targetIdentifier.trim() !== ''), {
  message: "Target User is required for single-user notifications",
  path: ["targetIdentifier"],
});

type NotificationFormData = z.infer<typeof notificationSchema>;

interface NotificationLog {
    id: string;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "alert";
    target: "all" | "single";
    targetIdentifier?: string;
    createdAt: Timestamp;
    status: 'sent' | 'failed';
    error?: string;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
}

const typeColors = {
  info: "bg-blue-500",
  success: "bg-green-500",
  warning: "bg-yellow-500",
  alert: "bg-red-500",
};

function UserSelector({ field, users, onSelect }: { field: any, users: AppUser[], onSelect: (value: string) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const handleSelect = (userId: string) => {
    onSelect(userId);
    setOpen(false);
  };

  const selectedUserEmail = field.value ? users.find(u => u.id === field.value)?.email : "Select user...";

  const UserList = (
     <Command>
        <CommandInput placeholder="Search user by email or name..." />
        <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-y-auto">
                {users.map((user) => (
                <CommandItem
                    key={user.id}
                    value={user.email}
                    onSelect={() => handleSelect(user.id)}
                    onClick={() => handleSelect(user.id)}
                >
                    <div className="flex w-full items-center">
                        <Check className={cn("mr-2 h-4 w-4", user.id === field.value ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                </CommandItem>
                ))}
            </CommandGroup>
        </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {selectedUserEmail}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select User</DialogTitle>
          </DialogHeader>
          {UserList}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedUserEmail}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        {UserList}
      </PopoverContent>
    </Popover>
  );
}


export default function AdminNotificationsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);

  const form = useForm<NotificationFormData>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      title: "",
      message: "",
      type: "info",
      target: "all",
      targetIdentifier: "",
    },
  });

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = form;

  const targetValue = watch("target");

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoadingHistory(true);

    // Fetch users
    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setUsers(usersData);
    });

    // Fetch history
    const historyQuery = query(collection(db, "notification_logs"), orderBy("createdAt", "desc"));
    const unsubscribeHistory = onSnapshot(historyQuery, (snapshot) => {
        const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NotificationLog));
        setHistory(logs);
        setLoadingHistory(false);
    });
    return () => {
        unsubscribeUsers();
        unsubscribeHistory();
    };
  }, [db, firebaseLoading]);

  const onSubmit = (data: NotificationFormData) => {
    if (!db) return;
    setIsSubmitting(true);
    
    const logPayload: Omit<NotificationLog, 'id' | 'status'> = {
        title: data.title,
        message: data.message,
        type: data.type,
        target: data.target,
        createdAt: Timestamp.now(),
    };

    let sendPromise: Promise<any>;

    if (data.target === "all") {
        const announcementPayload = {
            title: data.title,
            message: data.message,
            type: data.type,
            seen: false,
            createdAt: serverTimestamp(),
        };
        sendPromise = addDoc(collection(db, "announcements"), announcementPayload);
    } else {
        const targetUid = data.targetIdentifier!;
        const notificationPayload = {
            userId: targetUid,
            type: 'admin',
            title: data.title,
            message: data.message,
            amount: 0,
            status: 'unread',
            seen: false,
            createdAt: serverTimestamp(),
            relatedId: '',
        };
        sendPromise = addDoc(collection(db, "users", targetUid, "notifications"), notificationPayload);
        (logPayload as any).targetIdentifier = targetUid;
    }

    sendPromise.then(() => {
        const targetUser = users.find(u => u.id === data.targetIdentifier);
        toast({ 
            title: "Notification Sent", 
            description: data.target === 'all' ? "All users will receive this notification." : `Notification sent to user ${targetUser?.email}` 
        });
        reset();
        addLog(logPayload, 'sent');
    }).catch(error => {
        console.error("Error sending notification:", error);
        toast({ variant: "destructive", title: "Failed to Send Notification", description: error.message });
        addLog(logPayload, 'failed', error.message);
    }).finally(() => {
        setIsSubmitting(false);
    });
  };

  const addLog = (logData: Omit<NotificationLog, 'id' | 'status'>, status: 'sent' | 'failed', errorMsg?: string) => {
    if (!db) return;
    const batch = writeBatch(db);
    const logRef = doc(collection(db, "notification_logs"));
    const finalLogData: Partial<NotificationLog> = { ...logData, status };
    if (errorMsg) finalLogData.error = errorMsg;
    batch.set(logRef, finalLogData);
    
    const activityLogRef = doc(collection(db, "activityLogs"));
    batch.set(activityLogRef, {
        userId: 'ADMIN',
        action: `notification_sent_${logData.target}`,
        details: `Admin sent a notification titled "${logData.title}" to ${logData.target === 'all' ? 'all users' : `user: ${(logData as any).targetIdentifier}`}.`,
        timestamp: serverTimestamp(),
    });
    
    batch.commit();
  }

  const handleDeleteLog = (logId: string) => {
    if (!db) return;
    deleteDoc(doc(db, "notification_logs", logId)).then(() => {
        toast({ title: "Log Deleted", description: "The notification log has been removed." });
    }).catch(error => {
        console.error("Error deleting log:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the log." });
    });
  };

  const handleDeleteAllLogs = async () => {
    if (!db) return;
    const logsCollectionRef = collection(db, "notification_logs");
    try {
        const querySnapshot = await getDocs(logsCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No logs to delete."});
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        batch.commit().then(() => {
            toast({ title: "All Logs Deleted", description: "All notification logs have been removed." });
        }).catch(error => {
            console.error("Error deleting all logs:", error);
            toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all logs." });
        })
    } catch (error) {
        console.error("Error fetching logs for deletion:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not fetch all logs." });
    }
  };
  
  if (firebaseLoading || loadingHistory) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-bold text-white"><Send /> Send Notification</CardTitle>
          <CardDescription>Send notifications to all users or a specific user.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" {...register("title")} />
                    {errors.title && <p className="text-red-500 text-sm">{errors.title.message}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" {...register("message")} />
                    {errors.message && <p className="text-red-500 text-sm">{errors.message.message}</p>}
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label>Type</Label>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                <SelectItem value="info">Info</SelectItem>
                                <SelectItem value="success">Success</SelectItem>
                                <SelectItem value="warning">Warning</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                                </SelectContent>
                            </Select>
                            )}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Target</Label>
                        <Controller
                            name="target"
                            control={control}
                            render={({ field }) => (
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex items-center space-x-4 pt-2"
                                >
                                <FormItem className="flex items-center space-x-2">
                                    <RadioGroupItem value="all" id="all" />
                                    <Label htmlFor="all" className="flex items-center gap-2"><Users/> All Users</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2">
                                    <RadioGroupItem value="single" id="single" />
                                    <Label htmlFor="single" className="flex items-center gap-2"><User/> Single User</Label>
                                </FormItem>
                                </RadioGroup>
                            )}
                        />
                    </div>
                </div>

                {targetValue === "single" && (
                <div className="space-y-2">
                    <Label>User</Label>
                    <Controller
                        name="targetIdentifier"
                        control={control}
                        render={({ field }) => (
                           <UserSelector
                              field={field}
                              users={users}
                              onSelect={(value) => setValue("targetIdentifier", value)}
                            />
                        )}
                    />
                    {errors.targetIdentifier && <p className="text-red-500 text-sm">{errors.targetIdentifier.message}</p>}
                </div>
                )}
                
                <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : "Send Notification"}
                </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-white font-bold">Notification History</CardTitle>
              <CardDescription>A log of all notifications sent from the admin panel.</CardDescription>
            </div>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={history.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4"/> Delete All
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {history.length} notification logs. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllLogs} className="bg-destructive hover:bg-destructive/90">
                            Yes, Delete All
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </CardHeader>
        <CardContent>
             {loadingHistory ? (
                <div className="flex justify-center p-8"><LoaderCircle className="animate-spin"/></div>
             ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {history.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="whitespace-nowrap">{log.createdAt.toDate().toLocaleString()}</TableCell>
                                <TableCell>
                                    <Badge className={cn(typeColors[log.type], "text-white")}>{log.type}</Badge>
                                </TableCell>
                                <TableCell>{log.title}</TableCell>
                                <TableCell>
                                    {log.target === 'all' ? 'All Users' : <span className="font-mono text-xs break-all">{users.find(u=>u.id === log.targetIdentifier)?.email || log.targetIdentifier}</span>}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>{log.status}</Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Log?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this notification log? This action is irreversible.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteLog(log.id)} className="bg-destructive hover:bg-destructive/90">
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
                </div>
             )}
              {!loadingHistory && history.length === 0 && <p className="text-center text-muted-foreground p-8">No notifications have been sent yet.</p>}
        </CardContent>
      </Card>

    </div>
  );
}
    

    