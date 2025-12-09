
"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
  writeBatch,
  getDocs,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, LoaderCircle, Trash2, Eye } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useFirebase } from "@/lib/firebase/provider";

interface Feedback {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  category: string;
  message: string;
  status: "submitted" | "in_review" | "implemented" | "rejected";
  createdAt: Timestamp;
}

const statusColors: { [key: string]: string } = {
  submitted: "bg-gray-500",
  in_review: "bg-blue-500",
  implemented: "bg-green-500",
  rejected: "bg-red-500",
};

export default function AdminFeedbackPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const q = query(collection(db, "feedback"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const feedbackData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Feedback)
        );
        setFeedbackList(feedbackData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching feedback:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch feedback.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, toast, firebaseLoading]);

  const handleStatusChange = async (feedbackId: string, status: Feedback["status"]) => {
    if (!db) return;
    
    const originalFeedbackList = [...feedbackList];
    setFeedbackList(feedbackList.map(f => f.id === feedbackId ? {...f, status} : f));

    try {
        const feedbackDocRef = doc(db, "feedback", feedbackId);
        await updateDoc(feedbackDocRef, { status: status });
        toast({
            title: "Status Updated",
            description: `Feedback status changed to ${status.replace("_", " ")}.`,
        });
    } catch(error) {
        console.error("Error updating status:", error);
        setFeedbackList(originalFeedbackList);
        toast({ variant: "destructive", title: "Update Failed" });
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!db) return;
     
    const originalFeedbackList = [...feedbackList];
    setFeedbackList(feedbackList.filter(f => f.id !== feedbackId));
    
    try {
        await deleteDoc(doc(db, "feedback", feedbackId));
        toast({ title: "Feedback Deleted" });
    } catch (error) {
        console.error("Error deleting feedback:", error);
        setFeedbackList(originalFeedbackList);
        toast({ variant: "destructive", title: "Deletion Failed" });
    }
  };

  const handleDeleteAllFeedback = async () => {
    if (!db) return;
    const feedbackCollectionRef = collection(db, "feedback");
    try {
        const querySnapshot = await getDocs(feedbackCollectionRef);
        if (querySnapshot.empty) {
            toast({ title: "No feedback to delete." });
            return;
        }
        const batch = writeBatch(db);
        querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
        
        await batch.commit();
        toast({ title: "All Feedback Deleted", description: "All user feedback has been removed." });
    } catch (error) {
        console.error("Error deleting all feedback:", error);
        toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete all feedback." });
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
        <CardHeader className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-white font-bold flex items-center gap-2">
                <Lightbulb /> User Feedback & Suggestions
              </CardTitle>
              <CardDescription>
                Review and manage feedback submitted by users.
              </CardDescription>
            </div>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={feedbackList.length === 0}>
                        <Trash2 className="mr-2 h-4 w-4"/> Delete All
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete all {feedbackList.length} feedback submissions. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAllFeedback} className="bg-destructive hover:bg-destructive/90">
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
          ) : feedbackList.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No feedback has been submitted yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedbackList.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium">{item.userName}</div>
                        <div className="text-sm text-muted-foreground">{item.userEmail}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">{item.category}</Badge>
                      </TableCell>
                      <TableCell>{item.createdAt ? item.createdAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(value) => handleStatusChange(item.id, value as Feedback['status'])}
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="submitted">Submitted</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="implemented">Implemented</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedFeedback(item)}>
                            <Eye className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Feedback?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this feedback? This action is irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFeedback(item.id)} className="bg-destructive hover:bg-destructive/90">
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
        </CardContent>
      </Card>
      
      {/* View Feedback Dialog */}
      <Dialog open={!!selectedFeedback} onOpenChange={() => setSelectedFeedback(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Feedback from {selectedFeedback?.userName}</DialogTitle>
                <DialogDescription>Category: <span className="font-bold capitalize">{selectedFeedback?.category}</span></DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <p className="text-sm text-muted-foreground">{selectedFeedback?.message}</p>
            </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
