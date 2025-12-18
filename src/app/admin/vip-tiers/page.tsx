
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, Trophy, PlusCircle, Edit, Trash2, Palette } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
import { nanoid } from "nanoid";


const tierSchema = z.object({
    name: z.string().min(2, "Tier name must be at least 2 characters."),
    minDeposit: z.coerce.number().min(0, "Minimum deposit must be a positive number."),
    bonusPercentage: z.coerce.number().min(0).max(100).default(0),
    badgeColor: z.string().regex(/^#[0-9a-f]{6}$/i, "Must be a valid hex color code."),
    isEnabled: z.boolean().default(true),
});

type TierFormData = z.infer<typeof tierSchema>;

export interface VipTier {
  id: string;
  name: string;
  minDeposit: number;
  bonusPercentage: number;
  badgeColor: string;
  isEnabled: boolean;
  rank: number; // Used for ordering
}

export default function VipTiersPage() {
  const { db } = useFirebase();
  const [tiers, setTiers] = useState<VipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTier, setEditingTier] = useState<VipTier | null>(null);
  const { toast } = useToast();

  const form = useForm<TierFormData>({
    resolver: zodResolver(tierSchema),
    defaultValues: {
      name: "",
      minDeposit: 0,
      bonusPercentage: 0,
      badgeColor: "#808080",
      isEnabled: true,
    },
  });

  useEffect(() => {
    if (!db) return;
    setLoading(true);
    // UPDATED: Simple query
    const q = query(collection(db, "vipTiers"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        // UPDATED: Client-side sorting and ranking
        const tiersData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        } as Omit<VipTier, 'rank'>));
        
        tiersData.sort((a, b) => a.minDeposit - b.minDeposit);
        const rankedTiers = tiersData.map((tier, index) => ({ ...tier, rank: index + 1 }));

        setTiers(rankedTiers);
        setLoading(false);
    });
    return () => unsubscribe();
  }, [db]);

  const onSubmit = async (data: TierFormData) => {
    if (!db) return;
    setIsSubmitting(true);
    try {
        if (editingTier) {
            await updateDoc(doc(db, "vipTiers", editingTier.id), data);
            toast({ title: "Tier Updated" });
        } else {
            await addDoc(collection(db, "vipTiers"), data);
            toast({ title: "Tier Created" });
        }
        handleCancelEdit();
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleEdit = (tier: VipTier) => {
    setEditingTier(tier);
    form.reset(tier);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingTier(null);
    form.reset({
        name: "",
        minDeposit: 0,
        bonusPercentage: 0,
        badgeColor: "#808080",
        isEnabled: true,
    });
  };

  const handleDelete = async (tierId: string) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "vipTiers", tierId));
        toast({ title: "Tier Deleted" });
    } catch (error) {
        toast({ variant: "destructive", title: "Deletion Failed" });
    }
  }

  return (
    <div className="space-y-8">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white font-bold">
                    {editingTier ? <Edit /> : <PlusCircle />}
                    {editingTier ? "Edit VIP Tier" : "Create New VIP Tier"}
                </CardTitle>
                <CardDescription>
                    {editingTier ? `You are editing "${editingTier.name}".` : "Define a new VIP level for your users."}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Tier Name</Label>
                            <Input id="name" {...form.register("name")} />
                            {form.formState.errors.name && <p className="text-red-500 text-sm">{form.formState.errors.name.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="minDeposit">Min. Total Deposit ($)</Label>
                            <Input id="minDeposit" type="number" {...form.register("minDeposit")} />
                            {form.formState.errors.minDeposit && <p className="text-red-500 text-sm">{form.formState.errors.minDeposit.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="bonusPercentage">Bonus (%)</Label>
                            <Input id="bonusPercentage" type="number" {...form.register("bonusPercentage")} />
                            {form.formState.errors.bonusPercentage && <p className="text-red-500 text-sm">{form.formState.errors.bonusPercentage.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="badgeColor">Badge Color</Label>
                            <div className="flex items-center gap-2 h-10 border border-input rounded-md bg-background px-3">
                                <Palette className="h-5 w-5 text-muted-foreground"/>
                                <Input id="badgeColor" type="color" {...form.register("badgeColor")} className="p-0 border-0 h-8 w-8 bg-transparent" />
                                <span className="font-mono">{form.watch("badgeColor")}</span>
                            </div>
                            {form.formState.errors.badgeColor && <p className="text-red-500 text-sm">{form.formState.errors.badgeColor.message}</p>}
                        </div>
                        <div className="flex items-center space-x-2 pt-8">
                            <Switch id="isEnabled" {...form.register("isEnabled")} checked={form.watch("isEnabled")} onCheckedChange={(c) => form.setValue('isEnabled', c)} />
                            <Label htmlFor="isEnabled">Enable this tier</Label>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <LoaderCircle className="animate-spin mr-2"/>}
                            {editingTier ? "Update Tier" : "Create Tier"}
                        </Button>
                        {editingTier && <Button variant="outline" type="button" onClick={handleCancelEdit}>Cancel</Button>}
                    </div>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white font-bold"><Trophy/> Existing VIP Tiers</CardTitle>
                <CardDescription>A list of all VIP tiers, ordered by deposit requirement.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? (
                    <div className="flex justify-center p-8"><LoaderCircle className="animate-spin"/></div>
                 ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rank</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Min. Deposit</TableHead>
                                    <TableHead>Bonus %</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tiers.map(tier => (
                                    <TableRow key={tier.id}>
                                        <TableCell>{tier.rank}</TableCell>
                                        <TableCell>
                                            <Badge style={{ backgroundColor: tier.badgeColor }}>
                                                {tier.name}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>${tier.minDeposit.toLocaleString()}</TableCell>
                                        <TableCell>{tier.bonusPercentage}%</TableCell>
                                        <TableCell>
                                            <Badge variant={tier.isEnabled ? "default" : "destructive"}>
                                                {tier.isEnabled ? "Enabled" : "Disabled"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(tier)}>
                                                <Edit className="h-4 w-4"/>
                                            </Button>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="text-destructive">
                                                        <Trash2 className="h-4 w-4"/>
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This will permanently delete the "{tier.name}" tier. This cannot be undone.</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(tier.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
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
