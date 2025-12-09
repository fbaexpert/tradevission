
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  deleteDoc,
  writeBatch,
  Timestamp,
  orderBy,
  getDocs
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { LoaderCircle, FileClock, Trash2 } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";

interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  timestamp: Timestamp;
}

interface AppUser {
  id: string;
  email: string;
}

export default function AdminActivityLogsPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<Record<string, AppUser>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    // Fetch users to map userId to email
    const usersUnsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
        const usersData: Record<string, AppUser> = {};
        snapshot.forEach(doc => {
            usersData[doc.id] = { id: doc.id, email: doc.data().email };
        });
        setUsers(usersData);
    });

    const q = query(collection(db, "activityLogs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching activity logs:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch activity logs." });
      setLoading(false);
    });

    return () => {
      unsubscribe();
      usersUnsubscribe();
    };
  }, [db, toast, firebaseLoading]);

  const handleDeleteLog = async (logId: string) => {
    if (!db) return;

    const originalLogs = [...logs];
    setLogs(logs.filter(log => log.id !== logId));

    try {
        await deleteDoc(doc(db, "activityLogs", logId));
        toast({ title: "Log Deleted", description: "The activity log has been removed." });
    } catch(error) {
        console.error("Error deleting log:", error);
        setLogs(originalLogs);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the log." });
    }
  };

  const handleDeleteAllLogs = async () => {
    if (!db) return;
    const logsCollectionRef = collection(db, "activityLogs");
    try {
        const querySnapshot = await getDocs(logsCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No logs to delete."});
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        toast({ title: "All Logs Deleted", description: "All activity logs have been removed." });
    } catch (error) {
        console.error("Error deleting all logs:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all logs." });
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const userEmail = users[log.userId]?.email.toLowerCase() || "";
      const search = searchTerm.toLowerCase();
      return (
        userEmail.includes(search) ||
        log.action.toLowerCase().includes(search) ||
        log.details.toLowerCase().includes(search)
      );
    });
  }, [logs, users, searchTerm]);
  
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <CardTitle className="flex items-center gap-2 text-white font-bold">
                <FileClock />
                Activity Logs
                </CardTitle>
                <CardDescription>
                A record of all actions performed by users and admins.
                </CardDescription>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
                <Input
                    placeholder="Search logs..."
                    className="max-w-full md:max-w-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={logs.length === 0}>
                            <Trash2 className="mr-2 h-4 w-4"/> Delete All
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete all {logs.length} activity logs. This action cannot be undone.
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
            </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium break-all">{users[log.userId]?.email || log.userId}</TableCell>
                    <TableCell>{log.action}</TableCell>
                    <TableCell>{log.details}</TableCell>
                    <TableCell className="whitespace-nowrap">{log.timestamp ? log.timestamp.toDate().toLocaleString() : 'N/A'}</TableCell>
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
                                        Are you sure you want to delete this activity log? This action is irreversible.
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
             {filteredLogs.length === 0 && <p className="text-center text-muted-foreground p-8">No matching logs found.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
