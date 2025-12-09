
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  orderBy,
  Timestamp,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, LoaderCircle, Send } from "lucide-react";

interface Feedback {
  id: string;
  category: "bug_report" | "feature_request" | "general_feedback";
  message: string;
  status: "submitted" | "in_review" | "implemented" | "rejected";
  createdAt: Timestamp | null;
}

const statusColors: { [key: string]: string } = {
  submitted: "bg-gray-500",
  in_review: "bg-blue-500",
  implemented: "bg-green-500",
  rejected: "bg-red-500",
};

export default function FeedbackPage() {
  const { user } = useAuth();
  const { db, loading: firebaseLoading } = useFirebase();
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [category, setCategory] = useState<Feedback['category']>("general_feedback");
  const [message, setMessage] = useState("");

  const { toast } = useToast();

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, "feedback"), where("userId", "==", user.uid));
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
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const sortedFeedback = useMemo(() => {
    return [...feedbackList].sort((a, b) => {
      if (!a.createdAt) return 1;
      if (!b.createdAt) return -1;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });
  }, [feedbackList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !message.trim() || !db) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Please write a message for your feedback.",
      });
      return;
    }

    setIsSubmitting(true);
    addDoc(collection(db, "feedback"), {
      userId: user.uid,
      userName: user.displayName,
      userEmail: user.email,
      category,
      message,
      status: "submitted",
      createdAt: serverTimestamp(),
    })
      .then(() => {
        toast({
          title: "Feedback Submitted",
          description: "Thank you for helping us improve!",
        });
        setMessage("");
      })
      .catch((error) => {
        console.error("Error submitting feedback:", error);
        toast({ variant: "destructive", title: "Submission Failed" });
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  if (firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-4xl grid gap-8 md:grid-cols-1">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-white font-bold flex items-center gap-2">
              <Lightbulb /> Submit Your Feedback
            </CardTitle>
            <CardDescription>
              Your ideas help us make TradeVission better for everyone.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="category">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as Feedback['category'])}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general_feedback">General Feedback</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="bug_report">Bug Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Share your thoughts, suggestions, or issues..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled={isSubmitting}
                  rows={5}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Send />}
                <span>Submit Feedback</span>
              </Button>
            </CardFooter>
          </form>
        </Card>

        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <CardTitle className="text-white font-bold">Your Submission History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <LoaderCircle className="animate-spin" />
              </div>
            ) : sortedFeedback.length === 0 ? (
                <p className="text-center text-muted-foreground mt-4">You haven't submitted any feedback yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFeedback.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{item.category.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell><p className="truncate max-w-xs">{item.message}</p></TableCell>
                        <TableCell>
                          <Badge className={`${statusColors[item.status]} capitalize`}>
                            {item.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {item.createdAt ? item.createdAt.toDate().toLocaleString() : "Just now..."}
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
  );
}
