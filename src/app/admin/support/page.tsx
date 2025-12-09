
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  orderBy,
  where,
  Timestamp,
  getDocs,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { LifeBuoy, LoaderCircle, Send, ChevronsRight, MessageSquare, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
import { useFirebase } from "@/lib/firebase/provider";


interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  subject: string;
  message: string;
  status: "pending" | "replied" | "resolved";
  createdAt: Timestamp;
}

interface Reply {
    id: string;
    ticketId: string;
    userId: string;
    message: string;
    isSupport: boolean;
    createdAt: Timestamp;
}

const statusColors: { [key: string]: string } = {
  pending: "bg-yellow-500",
  replied: "bg-blue-500",
  resolved: "bg-green-500",
};


export default function AdminSupportPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);
    const q = query(collection(db, "supportTickets"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      setTickets(ticketsData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching tickets:", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db, firebaseLoading]);

  useEffect(() => {
    if (selectedTicket && db) {
      setIsRepliesLoading(true);
      const repliesQuery = query(
        collection(db, "supportTickets", selectedTicket.id, "replies"),
        orderBy("createdAt", "asc")
      );
      const unsubscribe = onSnapshot(repliesQuery, (snapshot) => {
        const repliesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reply));
        setReplies(repliesData);
        setIsRepliesLoading(false);
      });
      return () => unsubscribe();
    }
  }, [selectedTicket, db]);

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };
  
  const handleCloseDialog = () => {
    setSelectedTicket(null);
    setReplies([]);
    setReplyMessage("");
  };
  
  const handleReply = () => {
      if(!selectedTicket || !replyMessage.trim() || !db) return;
      setIsReplying(true);
      
      const replyPromise = addDoc(collection(db, "supportTickets", selectedTicket.id, "replies"), {
          ticketId: selectedTicket.id,
          userId: selectedTicket.userId,
          message: replyMessage,
          isSupport: true,
          createdAt: serverTimestamp()
      });
      
      const ticketDocRef = doc(db, "supportTickets", selectedTicket.id);
      const statusPromise = updateDoc(ticketDocRef, {
          status: "replied"
      });

      Promise.all([replyPromise, statusPromise]).then(() => {
        toast({ title: "Reply Sent" });
        setReplyMessage("");
        if(selectedTicket){
            setSelectedTicket({...selectedTicket, status: 'replied'});
        }
      }).catch((error) => {
          console.error("Error sending reply:", error);
          toast({ variant: "destructive", title: "Reply Failed" });
      }).finally(() => {
          setIsReplying(false);
      });
  }

  const handleUpdateStatus = (newStatus: "pending" | "replied" | "resolved") => {
      if(!selectedTicket || !db) return;
      
      const originalStatus = selectedTicket.status;
      setSelectedTicket({...selectedTicket, status: newStatus});

      const ticketDocRef = doc(db, "supportTickets", selectedTicket.id);
      updateDoc(ticketDocRef, { status: newStatus }).then(() => {
          toast({ title: `Ticket status updated to ${newStatus}` });
      }).catch((error) => {
           console.error("Error updating status:", error);
           setSelectedTicket({...selectedTicket, status: originalStatus});
           toast({ variant: "destructive", title: "Status Update Failed" });
      });
  }
  
  const handleDeleteTicket = async (ticketId: string) => {
    if (!db) return;
    
    const originalTickets = [...tickets];
    setTickets(tickets.filter(t => t.id !== ticketId));

    try {
        const batch = writeBatch(db);
        const repliesRef = collection(db, "supportTickets", ticketId, "replies");
        const repliesSnapshot = await getDocs(repliesRef);
        repliesSnapshot.forEach((doc) => batch.delete(doc.ref));
        batch.delete(doc(db, "supportTickets", ticketId));
        await batch.commit();
        toast({ title: "Ticket Deleted" });
        if (selectedTicket?.id === ticketId) {
            handleCloseDialog();
        }
    } catch(error) {
        console.error("Error deleting ticket:", error);
        setTickets(originalTickets);
        toast({ variant: "destructive", title: "Deletion failed" });
    }
  };

  const handleDeleteAllTickets = async () => {
    if (!db) return;
    const ticketsCollectionRef = collection(db, "supportTickets");
    try {
        const querySnapshot = await getDocs(ticketsCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No tickets to delete."});
            return;
        }
        const batch = writeBatch(db);
        for (const ticketDoc of querySnapshot.docs) {
            batch.delete(ticketDoc.ref);
            const messagesRef = collection(db, "supportTickets", ticketDoc.id, "replies");
            const messagesSnapshot = await getDocs(messagesRef);
            messagesSnapshot.forEach(msgDoc => batch.delete(msgDoc.ref));
        }
        
        await batch.commit();
        toast({ title: "All Tickets Deleted", description: "All support tickets have been removed." });
        setSelectedTicket(null);
    } catch (error) {
        console.error("Error deleting all tickets:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all tickets." });
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
    <>
      <Card>
        <CardHeader className="flex flex-row justify-between items-start">
          <div>
            <CardTitle className="text-white font-bold flex items-center gap-2"><LifeBuoy/> Support Tickets</CardTitle>
            <CardDescription>View and reply to user support tickets.</CardDescription>
          </div>
           <AlertDialog>
              <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={tickets.length === 0}>
                      <Trash2 className="mr-2 h-4 w-4"/> Delete All
                  </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                  <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                          This will permanently delete all {tickets.length} tickets. This action cannot be undone.
                      </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteAllTickets} className="bg-destructive hover:bg-destructive/90">
                          Yes, Delete All
                      </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
          </AlertDialog>
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
                        <TableHead>Subject</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tickets.map(ticket => (
                        <TableRow key={ticket.id}>
                            <TableCell>
                              <div className="font-medium whitespace-nowrap">{ticket.userName}</div>
                              <div className="text-sm text-muted-foreground break-all">{ticket.userEmail}</div>
                            </TableCell>
                            <TableCell>{ticket.subject}</TableCell>
                            <TableCell>
                            <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{ticket.createdAt ? ticket.createdAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => handleViewTicket(ticket)}>
                                  View <ChevronsRight className="ml-2 h-4 w-4"/>
                              </Button>
                            </TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          )}
           {!loading && tickets.length === 0 && <p className="text-center text-muted-foreground mt-4">No support tickets found.</p>}
        </CardContent>
      </Card>
      
      {/* View Ticket Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
                From: {selectedTicket?.userEmail} on {selectedTicket?.createdAt ? selectedTicket.createdAt.toDate().toLocaleString() : 'N/A'}
            </DialogDescription>
             <div className="flex items-center gap-2 pt-2">
                <span className="text-sm font-medium">Status:</span>
                <Badge className={statusColors[selectedTicket?.status || 'pending']}>
                    {selectedTicket?.status}
                </Badge>
            </div>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4">
              {isRepliesLoading ? <LoaderCircle className="animate-spin mx-auto"/> : (
                  <>
                    {/* Original Message */}
                    <div className="flex gap-3">
                         <div className="p-2 h-fit rounded-full bg-muted">
                            <MessageSquare className="h-5 w-5 text-muted-foreground"/>
                         </div>
                        <div className="flex-1 rounded-lg border bg-card p-3">
                            <p className="font-bold text-white">User Message:</p>
                            <p className="text-sm text-foreground">{selectedTicket?.message}</p>
                        </div>
                    </div>
                    {/* Replies */}
                    {replies.map(reply => (
                        <div key={reply.id} className={`flex gap-3 ${reply.isSupport ? '' : 'justify-end'}`}>
                             {reply.isSupport && (
                                <div className="p-2 h-fit rounded-full bg-primary/20">
                                    <LifeBuoy className="h-5 w-5 text-primary"/>
                                </div>
                             )}
                            <div className={`flex-1 rounded-lg p-3 max-w-lg ${reply.isSupport ? 'bg-primary/20 border-primary/40' : 'bg-muted border'}`}>
                                <p className={`font-bold text-white mb-1 ${reply.isSupport ? 'text-left' : 'text-right'}`}>
                                    {reply.isSupport ? 'Support Reply' : 'User Reply'}
                                </p>
                                <p className="text-sm text-foreground">{reply.message}</p>
                                <p className="text-xs text-muted-foreground mt-2 text-right">{reply.createdAt ? reply.createdAt.toDate().toLocaleString() : '...'}</p>
                            </div>
                            {!reply.isSupport && (
                                <div className="p-2 h-fit rounded-full bg-muted">
                                    <MessageSquare className="h-5 w-5 text-muted-foreground"/>
                                </div>
                             )}
                        </div>
                    ))}
                  </>
              )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-col sm:items-start gap-4">
            <div className="w-full">
                <Textarea 
                    placeholder="Type your reply here..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={isReplying || selectedTicket?.status === 'resolved'}
                />
                <Button onClick={handleReply} disabled={isReplying || selectedTicket?.status === 'resolved'} className="mt-2 w-full sm:w-auto">
                    {isReplying ? <LoaderCircle className="animate-spin"/> : <Send/>} <span>Send Reply</span>
                </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 self-start flex-wrap">
                <Button variant="secondary" onClick={() => handleUpdateStatus('pending')} disabled={selectedTicket?.status === 'pending'}>Mark as Pending</Button>
                <Button variant="secondary" onClick={() => handleUpdateStatus('replied')} disabled={selectedTicket?.status === 'replied'}>Mark as Replied</Button>
                <Button variant="destructive" onClick={() => handleUpdateStatus('resolved')} disabled={selectedTicket?.status === 'resolved'}>Mark as Resolved</Button>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="sm:ml-auto">
                            <Trash2 className="mr-2 h-4 w-4"/> Delete Ticket
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete this support ticket and all its messages. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => selectedTicket && handleDeleteTicket(selectedTicket.id)} className="bg-destructive hover:bg-destructive/90">
                                Yes, Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
