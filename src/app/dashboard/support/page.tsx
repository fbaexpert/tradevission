
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/auth-context';
import { useFirebase } from '@/lib/firebase/provider';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, orderBy, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle, LifeBuoy, AlertCircle, Send, ChevronsRight, MessageSquare } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";


interface Ticket {
  id: string;
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

export default function SupportPage() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [history, setHistory] = useState<Ticket[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyMessage, setReplyMessage] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const [isRepliesLoading, setIsRepliesLoading] = useState(false);

  useEffect(() => {
    if (!user || !db) {
        setLoadingHistory(false);
        return;
    };
    
    const q = query(
        collection(db, "supportTickets"), 
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const tickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
        setHistory(tickets);
        setLoadingHistory(false);
        setError(null);
    }, (err: any) => {
        console.error("Error fetching ticket history: ", err);
        if (err.code === 'failed-precondition' || err.code === 'permission-denied') {
             setError("Could not load your ticket history. The database may require a new index. Please contact support if this persists.");
        } else {
             setError("An unexpected error occurred while fetching your tickets.");
        }
        setLoadingHistory(false);
    });

    return () => unsubscribe();
  }, [user, db]);
  
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) {
      setError("You must be logged in to submit a ticket.");
      return;
    }
    if (!subject.trim() || !message.trim()) {
      setError("Please fill out both the subject and message fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addDoc(collection(db, "supportTickets"), {
        userId: user.uid,
        userName: user.displayName,
        userEmail: user.email,
        subject: subject,
        message: message,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: "Ticket Submitted!",
        description: "Our support team will get back to you shortly.",
      });

      setSubject('');
      setMessage('');

    } catch (err: any) {
      setError(err.message || "Failed to submit ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleReply = () => {
      if(!selectedTicket || !replyMessage.trim() || !user || !db) return;
      setIsReplying(true);
      
      addDoc(collection(db, "supportTickets", selectedTicket.id, "replies"), {
          ticketId: selectedTicket.id,
          userId: user.uid,
          message: replyMessage,
          isSupport: false,
          createdAt: serverTimestamp()
      });
      
      const ticketDocRef = doc(db, "supportTickets", selectedTicket.id);
      updateDoc(ticketDocRef, {
          status: "pending"
      }).then(() => {
        toast({ title: "Reply Sent" });
        setReplyMessage("");
      }).catch((error) => {
          console.error("Error sending reply:", error);
          toast({ variant: "destructive", title: "Reply Failed" });
      }).finally(() => {
          setIsReplying(false);
      });
  }

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };
  
  const handleCloseDialog = () => {
    setSelectedTicket(null);
    setReplies([]);
    setReplyMessage("");
  };

  return (
    <>
    <div className="p-4 sm:p-6 md:p-8 space-y-8">
      <div className="container mx-auto max-w-4xl">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
             <div className="flex items-center gap-4">
                <LifeBuoy className="h-8 w-8 text-primary"/>
                <div>
                    <CardTitle className="text-2xl font-bold text-white">
                        Contact Support
                    </CardTitle>
                    <CardDescription>
                        Have an issue? Fill out the form below and we'll get back to you.
                    </CardDescription>
                </div>
            </div>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
                {error && !loadingHistory && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-2">
                    <Label htmlFor="subject">Subject</Label>
                    <Input 
                        id="subject" 
                        placeholder="e.g., Issue with my plan"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={loading}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea 
                        id="message" 
                        placeholder="Please describe your issue in detail..."
                        rows={6}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        disabled={loading}
                    />
                </div>
            </CardContent>
            <CardFooter>
                 <Button type="submit" disabled={loading}>
                    {loading ? <LoaderCircle className="animate-spin" /> : <Send/>}
                    <span>Submit Ticket</span>
                </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="mt-8 border-border/20 shadow-lg shadow-primary/5">
            <CardHeader>
                <CardTitle className="text-white font-bold">Your Support History</CardTitle>
                <CardDescription>A list of your past and current support tickets.</CardDescription>
            </CardHeader>
            <CardContent>
                {loadingHistory ? (
                    <div className="flex justify-center p-8"><LoaderCircle className="animate-spin" /></div>
                ) : history.length === 0 && !error ? (
                    <p className="text-center text-muted-foreground p-4">You have not submitted any tickets yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Date Submitted</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map(ticket => (
                                    <TableRow key={ticket.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewTicket(ticket)}>
                                        <TableCell className="font-medium">{ticket.subject}</TableCell>
                                        <TableCell>
                                            <Badge className={`${statusColors[ticket.status]} capitalize`}>{ticket.status}</Badge>
                                        </TableCell>
                                        <TableCell>{ticket.createdAt ? ticket.createdAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm">
                                                View <ChevronsRight className="ml-2 h-4 w-4"/>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>

      </div>
    </div>
     {/* View Ticket Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>
                Submitted on {selectedTicket?.createdAt ? selectedTicket.createdAt.toDate().toLocaleString() : 'N/A'}
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
                            <p className="font-bold text-white">Your Message:</p>
                            <p className="text-sm text-foreground">{selectedTicket?.message}</p>
                        </div>
                    </div>
                    {/* Replies */}
                    {replies.map(reply => (
                        <div key={reply.id} className={`flex gap-3 ${!reply.isSupport ? '' : 'justify-end'}`}>
                             {!reply.isSupport && (
                                <div className="p-2 h-fit rounded-full bg-primary/20">
                                    <MessageSquare className="h-5 w-5 text-primary"/>
                                </div>
                             )}
                            <div className={`flex-1 rounded-lg p-3 max-w-lg ${!reply.isSupport ? 'bg-primary/20 border-primary/40' : 'bg-muted border'}`}>
                                <p className={`font-bold text-white mb-1 ${!reply.isSupport ? 'text-left' : 'text-right'}`}>
                                    {!reply.isSupport ? 'Your Reply' : 'Support Reply'}
                                </p>
                                <p className="text-sm text-foreground">{reply.message}</p>
                                <p className="text-xs text-muted-foreground mt-2 text-right">{reply.createdAt ? reply.createdAt.toDate().toLocaleString() : '...'}</p>
                            </div>
                            {reply.isSupport && (
                                <div className="p-2 h-fit rounded-full bg-muted">
                                    <LifeBuoy className="h-5 w-5 text-muted-foreground"/>
                                </div>
                             )}
                        </div>
                    ))}
                  </>
              )}
          </div>
          
          <DialogFooter className="flex-col sm:flex-col sm:items-start gap-4">
            <div className="w-full">
                <Label htmlFor="reply-message" className="sr-only">Reply Message</Label>
                <Textarea 
                    id="reply-message"
                    placeholder="Type your reply here..."
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    disabled={isReplying || selectedTicket?.status === 'resolved'}
                />
                <Button onClick={handleReply} disabled={isReplying || !replyMessage.trim() || selectedTicket?.status === 'resolved'} className="mt-2 w-full sm:w-auto">
                    {isReplying ? <LoaderCircle className="animate-spin" /> : <Send />} <span>Send Reply</span>
                </Button>
            </div>
            {selectedTicket?.status === 'resolved' && (
                <p className="text-sm text-muted-foreground">This ticket has been resolved. Please open a new ticket for further inquiries.</p>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
