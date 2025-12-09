
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
  serverTimestamp,
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
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { LoaderCircle, ShieldCheck, Check, X, Eye, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useFirebase } from "@/lib/firebase/provider";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


interface KYCSubmission {
    id: string;
    userId: string;
    userEmail: string;
    fullName: string;
    idType: string;
    idNumber: string;
    idFrontUrl: string;
    idBackUrl: string;
    selfieUrl: string;
    status: 'pending' | 'in_review' | 'approved' | 'rejected';
    submittedAt: Timestamp;
    rejectionReason?: string;
}

export default function AdminKycPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [submissions, setSubmissions] = useState<KYCSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<KYCSubmission | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [newStatus, setNewStatus] = useState<KYCSubmission['status'] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const q = query(collection(db, "kycSubmissions"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as KYCSubmission)
        );
        setSubmissions(subs.sort((a, b) => (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0)));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching KYC submissions:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Could not fetch KYC submissions.",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, toast, firebaseLoading]);

  const handleUpdateStatus = async (submission: KYCSubmission) => {
      if (!db || !newStatus) return;
      if (newStatus === 'rejected' && !rejectionReason.trim()) {
          toast({ variant: "destructive", title: "Reason Required", description: "Please provide a reason for rejection."});
          return;
      }
      
      const batch = writeBatch(db);
      const kycDocRef = doc(db, "kycSubmissions", submission.userId);
      const userDocRef = doc(db, "users", submission.userId);
      
      batch.update(kycDocRef, { 
        status: newStatus,
        rejectionReason: newStatus === 'rejected' ? rejectionReason : null,
      });

      batch.update(userDocRef, { kycStatus: newStatus });
      
      const notifTitle = `KYC ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1).replace('_', ' ')}`;
      let notifMessage = `Your KYC status has been updated to: ${newStatus.replace('_', ' ')}.`;
      if (newStatus === 'approved') {
          notifMessage = 'Congratulations! Your KYC verification has been approved.';
      } else if (newStatus === 'rejected') {
          notifMessage = `Your KYC submission was rejected. Reason: ${rejectionReason}`;
      } else if (newStatus === 'in_review') {
          notifMessage = 'Your KYC submission is now being reviewed by our team.';
      }
      
      const notifRef = doc(collection(db, "users", submission.userId, "notifications"));
      batch.set(notifRef, {
        userId: submission.userId,
        type: newStatus === 'approved' ? 'success' : (newStatus === 'rejected' ? 'alert' : 'info'),
        title: notifTitle,
        message: notifMessage,
        status: 'unread', seen: false, createdAt: serverTimestamp(),
      });
      
      try {
        await batch.commit();
        toast({ title: "Status Updated" });
        setSelectedSubmission(null);
        setRejectionReason("");
        setNewStatus(null);
      } catch (error) {
        toast({ variant: "destructive", title: "Update Failed" });
      }
  };
  
  const openReviewDialog = (submission: KYCSubmission) => {
    setSelectedSubmission(submission);
    setNewStatus(submission.status);
    setRejectionReason(submission.rejectionReason || "");
  }

  const ImageViewer = ({ src, alt }: { src?: string; alt: string }) => (
    <div className="w-full h-64 relative bg-muted rounded-lg overflow-hidden border">
        {src ? (
            <Image src={src} alt={alt} fill style={{ objectFit: 'contain' }} />
        ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>
        )}
    </div>
  );

  const renderTable = (data: KYCSubmission[]) => (
    <div className="overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Full Name</TableHead>
                    <TableHead>ID Type / Number</TableHead>
                    <TableHead>Date Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
            {data.map((item) => (
                <TableRow key={item.id}>
                    <TableCell>
                        <div className="font-medium">{item.userEmail}</div>
                    </TableCell>
                    <TableCell>{item.fullName}</TableCell>
                    <TableCell>
                        <Badge variant="secondary" className="capitalize">{item.idType.replace("_", " ")}</Badge>
                        <div className="text-sm text-muted-foreground mt-1">{item.idNumber}</div>
                    </TableCell>
                    <TableCell>{item.submittedAt ? item.submittedAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>
                        <Badge variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'}>
                           {item.status.replace('_', ' ')}
                        </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => openReviewDialog(item)}>
                            <Eye className="mr-2 h-4 w-4" /> Review
                        </Button>
                    </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
        {data.length === 0 && <p className="text-center text-muted-foreground p-8">No submissions in this category.</p>}
    </div>
  );

  if (loading || firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  const pendingSubmissions = submissions.filter(s => s.status === 'pending' || s.status === 'in_review');
  const processedSubmissions = submissions.filter(s => s.status === 'approved' || s.status === 'rejected');

  return (
    <>
      <Card>
        <CardHeader>
            <CardTitle className="text-white font-bold flex items-center gap-2">
                <ShieldCheck /> KYC Submissions
            </CardTitle>
            <CardDescription>
                Review and manage user identity verification submissions.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending">Pending Review</TabsTrigger>
                    <TabsTrigger value="processed">Processed</TabsTrigger>
                </TabsList>
                <TabsContent value="pending">
                    {renderTable(pendingSubmissions)}
                </TabsContent>
                <TabsContent value="processed">
                    {renderTable(processedSubmissions)}
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
      
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl">
            <DialogHeader>
                <DialogTitle>Review KYC for {selectedSubmission?.fullName}</DialogTitle>
                <DialogDescription>
                    User: {selectedSubmission?.userEmail} | Submitted: {selectedSubmission?.submittedAt ? selectedSubmission.submittedAt.toDate().toLocaleString() : 'N/A'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid md:grid-cols-3 gap-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
                <div className="space-y-2">
                    <h4 className="font-bold">ID Front</h4>
                    <ImageViewer src={selectedSubmission?.idFrontUrl} alt="ID Front" />
                </div>
                 <div className="space-y-2">
                    <h4 className="font-bold">ID Back</h4>
                    <ImageViewer src={selectedSubmission?.idBackUrl} alt="ID Back" />
                </div>
                <div className="space-y-2">
                    <h4 className="font-bold">Selfie with ID</h4>
                    <ImageViewer src={selectedSubmission?.selfieUrl} alt="Selfie with ID" />
                </div>
            </div>
            <DialogFooter className="flex-col sm:flex-col items-start gap-4 border-t pt-4">
                 <div className="w-full grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="kycStatus">Update Status</Label>
                         <Select value={newStatus || ''} onValueChange={(value) => setNewStatus(value as KYCSubmission['status'])}>
                            <SelectTrigger id="kycStatus">
                                <SelectValue placeholder="Select a status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="in_review">In Review</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                 </div>
                 {newStatus === 'rejected' && (
                    <div className="w-full">
                        <Label htmlFor="rejectionReason">Rejection Reason</Label>
                        <Textarea 
                            id="rejectionReason"
                            placeholder="Provide a clear reason for the user..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                 )}
                <div className="flex gap-2">
                    <Button onClick={() => selectedSubmission && handleUpdateStatus(selectedSubmission)}>
                        <Check className="mr-2"/> Update Status
                    </Button>
                     <Button variant="outline" onClick={() => setSelectedSubmission(null)}>Cancel</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
