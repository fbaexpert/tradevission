
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
  deleteDoc,
  doc
} from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Gift, LoaderCircle, Trash2, Coins, DollarSign } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const redPacketSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters long."),
  totalAmount: z.coerce.number().positive("Total amount must be a positive number."),
  packetCount: z.coerce.number().int().min(2, "Packet count must be at least 2."),
  assetType: z.enum(["balance", "cpm_coin"]),
});

type RedPacketFormData = z.infer<typeof redPacketSchema>;

interface AirdropEvent {
    id: string;
    title: string;
    totalAmount: number;
    assetType: "balance" | "cpm_coin";
    packetCount: number;
    claimedCount: number;
    claimedAmount: number;
    createdAt: Timestamp;
    status: 'active' | 'finished';
}

export default function AdminAirdropPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [airdropEvents, setAirdropEvents] = useState<AirdropEvent[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const form = useForm<RedPacketFormData>({
    resolver: zodResolver(redPacketSchema),
    defaultValues: {
      title: "",
      totalAmount: 100,
      packetCount: 10,
      assetType: "balance",
    },
  });

  useEffect(() => {
    if (!db) return;
    setLoadingHistory(true);
    const q = query(collection(db, "airdrops"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AirdropEvent));
        setAirdropEvents(events);
        setLoadingHistory(false);
    });
    return () => unsubscribe();
  }, [db]);


  const onSubmit = async (data: RedPacketFormData) => {
    if (!db) return;
    setIsSubmitting(true);
    
    try {
        await addDoc(collection(db, "airdrops"), {
            title: data.title,
            totalAmount: data.totalAmount,
            packetCount: data.packetCount,
            assetType: data.assetType,
            claimedCount: 0,
            claimedAmount: 0,
            status: 'active',
            createdAt: serverTimestamp(),
            claims: {}, // To store which user claimed what
        });
        toast({ title: "Red Packet Airdrop Created!", description: "Users can now claim their random reward." });
        form.reset();

    } catch (error) {
        console.error("Error creating airdrop:", error);
        toast({ variant: "destructive", title: "Airdrop Failed", description: "An unexpected error occurred." });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleDeleteAirdrop = async (id: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "airdrops", id));
      toast({ title: "Airdrop Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion failed" });
    }
  };

  if (firebaseLoading) {
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
          <CardTitle className="flex items-center gap-2 font-bold text-white"><Gift /> Create Red Packet Airdrop</CardTitle>
          <CardDescription>Create a pool of rewards for users to claim a random amount from.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="title">Airdrop Title</Label>
                <Input id="title" {...form.register("title")} placeholder="e.g., New Year Bonus"/>
                {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                 <div className="space-y-2">
                    <Label htmlFor="totalAmount">Total Amount</Label>
                    <Input id="totalAmount" type="number" step="0.01" {...form.register("totalAmount")} />
                    {form.formState.errors.totalAmount && <p className="text-red-500 text-sm">{form.formState.errors.totalAmount.message}</p>}
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="packetCount">Number of Packets (Claims)</Label>
                    <Input id="packetCount" type="number" {...form.register("packetCount")} />
                    {form.formState.errors.packetCount && <p className="text-red-500 text-sm">{form.formState.errors.packetCount.message}</p>}
                </div>
            </div>
            
            <div className="space-y-2">
                <Label>Asset Type</Label>
                <RadioGroup
                onValueChange={(value) => form.setValue('assetType', value as "balance" | "cpm_coin")}
                defaultValue={form.getValues('assetType')}
                className="flex flex-col sm:flex-row gap-4 pt-2"
                >
                    <Label className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors cursor-pointer">
                        <RadioGroupItem value="balance" id="balance" />
                        <DollarSign/> Balance (USD)
                    </Label>
                     <Label className="flex items-center gap-2 p-3 border rounded-md has-[:checked]:bg-primary/20 has-[:checked]:border-primary transition-colors cursor-pointer">
                        <RadioGroupItem value="cpm_coin" id="cpm_coin" />
                        <Coins/> CPM Coins
                    </Label>
                </RadioGroup>
            </div>
            
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin" /> : "Create Airdrop Event"}
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
            <CardTitle>Airdrop History</CardTitle>
            <CardDescription>A log of all created Red Packet airdrops.</CardDescription>
        </CardHeader>
        <CardContent>
             {loadingHistory ? (
                <div className="flex justify-center p-8"><LoaderCircle className="animate-spin"/></div>
             ) : airdropEvents.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">No airdrop events have been created yet.</p>
             ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Title</TableHead>
                            <TableHead>Asset</TableHead>
                            <TableHead>Total Pool</TableHead>
                            <TableHead>Claims</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created At</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {airdropEvents.map(event => (
                            <TableRow key={event.id}>
                               <TableCell className="font-medium">{event.title}</TableCell>
                               <TableCell>
                                    <Badge variant="secondary" className="capitalize">{event.assetType.replace('_', ' ')}</Badge>
                               </TableCell>
                               <TableCell>{event.assetType === 'balance' ? '$' : ''}{event.totalAmount.toLocaleString()}{event.assetType === 'cpm_coin' ? ' CPM' : ''}</TableCell>
                               <TableCell>{event.claimedCount} / {event.packetCount}</TableCell>
                               <TableCell>
                                    <Badge variant={event.status === 'active' ? 'default' : 'destructive'}>{event.status}</Badge>
                               </TableCell>
                               <TableCell>{event.createdAt ? event.createdAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                               <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                                                <Trash2 className="h-4 w-4"/>
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Delete Airdrop?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Are you sure you want to delete this airdrop? This action is irreversible and will remove it from the user's view.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteAirdrop(event.id)} className="bg-destructive hover:bg-destructive/90">
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
    </div>
  );
}
