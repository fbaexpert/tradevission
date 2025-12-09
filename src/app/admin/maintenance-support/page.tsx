
"use client";

import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  addDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Wrench, LoaderCircle, Send, MessageSquare, Check, RefreshCw, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
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
  userName: string;
  userEmail: string;
  createdAt: Timestamp;
  lastMessage?: string;
  status: 'open' | 'replied' | 'closed';
}

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'admin';
    timestamp: Timestamp;
}

export default function MaintenanceSupportPage() {
  const { user } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const { toast } = useToast();
  const chatContentRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const q = query(collection(db, "support_tickets"), orderBy("createdAt", "desc"));
    
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
      setIsMessagesLoading(true);
      const messagesQuery = query(
        collection(db, "support_tickets", selectedTicket.id, "messages"),
        orderBy("timestamp", "asc")
      );
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(messagesData);
        setIsMessagesLoading(false);
      }, () => {
        setIsMessagesLoading(false);
      });
      return () => unsubscribe();
    } else {
        setMessages([]);
    }
  }, [selectedTicket, db]);

   useEffect(() => {
    if (chatContentRef.current) {
        chatContentRef.current.scrollTop = chatContentRef.current.scrollHeight;
    }
   }, [messages]);
  
  const handleReply = async () => {
      if(!selectedTicket || !replyMessage.trim() || !user || !db) return;
      setIsReplying(true);
      const ticketDocRef = doc(db, "support_tickets", selectedTicket.id);

      addDoc(collection(ticketDocRef, "messages"), {
          text: replyMessage,
          sender: 'admin',
          timestamp: serverTimestamp()
      });

      // Update last message and status on parent ticket
      updateDoc(ticketDocRef, {
          status: 'replied',
          createdAt: serverTimestamp() // To bring it to the top of the list
      });

      toast({ title: "Reply Sent" });
      setReplyMessage("");
      setIsReplying(false);
  }

  const handleUpdateStatus = async (ticketId: string, status: 'open' | 'replied' | 'closed') => {
      if (!db) return;
      updateDoc(doc(db, "support_tickets", ticketId), { status });
      toast({ title: `Ticket marked as ${status}`});
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => prev ? { ...prev, status } : null);
      }
  }
  
  const handleDeleteTicket = async (ticketId: string) => {
    if (!db) return;
    // Also delete subcollection
    const messagesRef = collection(db, "support_tickets", ticketId, "messages");
    const messagesSnapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    messagesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    batch.delete(doc(db, "support_tickets", ticketId));
    
    batch.commit().then(() => {
        toast({ title: "Ticket Deleted", description: "The ticket and all its messages have been removed." });
        if (selectedTicket?.id === ticketId) {
            setSelectedTicket(null);
        }
    }).catch(error => {
        console.error("Error deleting ticket:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the ticket." });
    });
  };

  const handleDeleteAllTickets = async () => {
    if (!db) return;
    const ticketsCollectionRef = collection(db, "support_tickets");
    try {
        const querySnapshot = await getDocs(ticketsCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No tickets to delete."});
            return;
        }
        const batch = writeBatch(db);
        for (const ticketDoc of querySnapshot.docs) {
            batch.delete(ticketDoc.ref);
            // Must also delete subcollections in a separate process or loop
            const messagesRef = collection(db, "support_tickets", ticketDoc.id, "messages");
            const messagesSnapshot = await getDocs(messagesRef);
            messagesSnapshot.forEach(msgDoc => batch.delete(msgDoc.ref));
        }
        
        batch.commit().then(() => {
            toast({ title: "All Tickets Deleted", description: "All support tickets have been removed." });
            setSelectedTicket(null);
        }).catch(error => {
            console.error("Error deleting all tickets:", error);
            toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all tickets." });
        })
    } catch (error) {
        console.error("Error fetching tickets for deletion:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not fetch tickets to delete." });
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
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-4">
        {/* Tickets List */}
        <Card className="w-full md:w-1/3 xl:w-1/4 h-full flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-white font-bold flex items-center gap-2"><Wrench/> Maintenance Support</CardTitle>
                        <CardDescription>View and reply to messages sent during maintenance mode.</CardDescription>
                    </div>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" disabled={tickets.length === 0}>
                                <Trash2 className="h-4 w-4"/>
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete all {tickets.length} support tickets. This action cannot be undone.
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
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-2">
            {loading ? (
                <div className="flex justify-center items-center h-full">
                <LoaderCircle className="animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                    {tickets.map(ticket => (
                        <div key={ticket.id} className={`w-full text-left p-3 rounded-lg border transition-colors relative group cursor-pointer ${selectedTicket?.id === ticket.id ? 'bg-primary/20 border-primary' : 'bg-muted/30 hover:bg-muted/50 border-transparent'}`} onClick={() => setSelectedTicket(ticket)}>
                             <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-white">{ticket.userName}</p>
                                    <p className="text-xs text-muted-foreground">{ticket.userEmail}</p>
                                </div>
                                <span className={`capitalize text-xs px-2 py-0.5 rounded-full ${ticket.status === 'closed' ? 'bg-red-500/20 text-red-400' : ticket.status === 'replied' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{ticket.status}</span>
                            </div>
                            <p className="text-sm text-foreground truncate mt-2">{ticket.lastMessage}</p>
                            <p className="text-xs text-muted-foreground text-right mt-1">{ticket.createdAt?.toDate().toLocaleDateString()}</p>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                                        <Trash2 className="h-4 w-4"/>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Ticket?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this support ticket and all its messages. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteTicket(ticket.id)} className="bg-destructive hover:bg-destructive/90">
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    ))}
                </div>
            )}
            {!loading && tickets.length === 0 && <p className="text-center text-muted-foreground mt-4">No support messages found.</p>}
            </CardContent>
        </Card>
        
        {/* Chat View */}
        <Card className="w-full md:w-2/3 xl:w-3/4 h-full flex flex-col">
            {selectedTicket ? (
                <>
                <CardHeader className="border-b">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                            <CardTitle className="text-white font-bold">Conversation with {selectedTicket.userName}</CardTitle>
                            <CardDescription>
                                Ticket ID: {selectedTicket.id}
                            </CardDescription>
                        </div>
                         <div className="flex items-center gap-2 flex-wrap">
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, 'open')} disabled={selectedTicket.status === 'open'}><RefreshCw className="h-4 w-4 mr-1"/> Open</Button>
                            <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(selectedTicket.id, 'closed')} disabled={selectedTicket.status === 'closed'}><Check className="h-4 w-4 mr-1"/> Close</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent ref={chatContentRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isMessagesLoading ? <LoaderCircle className="animate-spin mx-auto"/> : (
                        messages.map(msg => (
                            <div key={msg.id} className={`flex flex-col ${msg.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                                <div className={`rounded-lg p-3 max-w-lg ${msg.sender === 'admin' ? 'bg-primary text-primary-foreground text-right' : 'bg-muted'}`}>
                                    <p className="text-sm">{msg.text}</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {msg.timestamp?.toDate().toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                    {messages.length === 0 && !isMessagesLoading && (
                        <p className="text-center text-muted-foreground">No messages yet.</p>
                    )}
                </CardContent>
                <CardContent className="border-t pt-4">
                    <div className="relative">
                        <Textarea 
                            placeholder="Type your reply here..."
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(); }}}
                            disabled={isReplying}
                            className="pr-20"
                        />
                        <Button onClick={handleReply} disabled={isReplying || !replyMessage.trim()} className="absolute right-2 bottom-2">
                            {isReplying ? <LoaderCircle className="animate-spin"/> : <Send className="h-4 w-4"/>}
                        </Button>
                    </div>
                </CardContent>
                </>
            ) : (
                <div className="flex-1 flex flex-col justify-center items-center text-center text-muted-foreground p-4">
                     <MessageSquare className="h-16 w-16 mb-4"/>
                    <h3 className="text-lg font-bold text-foreground">Select a conversation</h3>
                    <p>Choose a ticket from the left to view the messages.</p>
                </div>
            )}
        </Card>
    </div>
  );
}
