
"use client";
import { useState, useEffect } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
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
  Timestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  LoaderCircle,
  Package,
  PlusCircle,
  Edit,
  Trash2,
  Percent,
  Calendar as CalendarIcon,
  KeyRound
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFirebase } from "@/lib/firebase/provider";

const offerSchema = z.object({
    enabled: z.boolean().default(false),
    discountPercentage: z.coerce.number().min(0).max(100).default(0),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    includeVipCode: z.boolean().default(false),
});

const planSchema = z.object({
  planName: z.string().min(1, "Plan name is required"),
  price: z.coerce.number().positive("Price must be positive"),
  dailyAds: z.coerce.number().int().min(0, "Daily ads must be 0 or more"),
  durationDays: z.coerce.number().int().positive("Duration must be positive"),
  totalProfit: z.coerce.number().min(0, "Total profit cannot be negative"),
  dailyProfit: z.coerce.number().min(0, "Daily profit cannot be negative"),
  status: z.enum(["active", "inactive"]),
  tag: z.string().optional(),
  description: z.string().optional(),
  minPurchaseLimit: z.coerce.number().min(0).optional(),
  maxPurchaseLimit: z.coerce.number().min(0).optional(),
  visibility: z.enum(["public", "hidden"]),
  offer: offerSchema.optional(),
});

type PlanFormData = z.infer<typeof planSchema>;

interface Plan extends PlanFormData {
  id: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface PlanTag {
    id: string;
    name: string;
    color: string;
}

export default function ManagePlansPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planTags, setPlanTags] = useState<PlanTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const { toast } = useToast();

  const form = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      planName: "",
      price: 0,
      dailyAds: 1,
      durationDays: 30,
      totalProfit: 0,
      dailyProfit: 0,
      status: "active",
      tag: "none",
      description: "",
      minPurchaseLimit: 0,
      maxPurchaseLimit: 0,
      visibility: "public",
      offer: {
        enabled: false,
        discountPercentage: 10,
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        includeVipCode: false,
      },
    },
  });

  const { register, handleSubmit, reset, setValue, control, watch } = form;
  const { errors } = form.formState;

  const dailyProfit = watch("dailyProfit");
  const durationDays = watch("durationDays");
  const offerEnabled = watch("offer.enabled");
  const offerStartTime = watch("offer.startTime");
  const offerEndTime = watch("offer.endTime");

  useEffect(() => {
    const profit = parseFloat(String(dailyProfit)) || 0;
    const duration = parseInt(String(durationDays), 10) || 0;
    if (profit > 0 && duration > 0) {
      const total = profit * duration;
      setValue("totalProfit", parseFloat(total.toFixed(2)));
    } else {
      setValue("totalProfit", 0);
    }
  }, [dailyProfit, durationDays, setValue]);


  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, "plans"), orderBy("createdAt", "desc"));
    const unsubscribePlans = onSnapshot(
      q,
      (snapshot) => {
        const plansData = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as Plan)
        );
        setPlans(plansData);
        if(!planTags.length) setLoading(false);
      },
      (error) => {
        console.error("Error fetching plans:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch plans." });
        setLoading(false);
      }
    );
    
    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeTags = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setPlanTags(data.planTags || []);
        }
        setLoading(false);
    });

    return () => {
      unsubscribePlans();
      unsubscribeTags();
    }
  }, [db, toast, planTags.length]);

  const onSubmit: SubmitHandler<PlanFormData> = (data) => {
    if (!db) return;
    setIsSubmitting(true);

    const planData: Omit<PlanFormData, "offer"> & { offer?: any, updatedAt: any } = {
      ...data,
      offer: {
        ...data.offer,
        startTime: data.offer?.startTime ? new Date(data.offer.startTime).toISOString() : new Date().toISOString(),
        endTime: data.offer?.endTime ? new Date(data.offer.endTime).toISOString() : new Date().toISOString(),
      },
      updatedAt: serverTimestamp(),
    };
    
    let promise;
    if (editingPlan) {
        const planDocRef = doc(db, "plans", editingPlan.id);
        promise = updateDoc(planDocRef, planData);
    } else {
        promise = addDoc(collection(db, "plans"), {
          ...planData,
          createdAt: serverTimestamp(),
        });
    }

    promise.then(() => {
        toast({ title: "Success", description: `Plan ${editingPlan ? 'updated' : 'created'} successfully.` });
        handleCancelEdit();
    }).catch((error) => {
        console.error("Error saving plan:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not save the plan.",
        });
    }).finally(() => {
        setIsSubmitting(false);
    });
  };

  const handleOfferDateTimeChange = (field: 'startTime' | 'endTime', value: string, type: 'date' | 'time') => {
      const currentOffer = watch('offer');
      if (!currentOffer || !value) return;

      const currentDateTime = currentOffer[field] ? new Date(currentOffer[field]) : new Date();
      let newDateTime;

      if (type === 'date') {
          const newDate = new Date(value);
          if(isNaN(newDate.getTime())) return;
          newDate.setHours(currentDateTime.getHours(), currentDateTime.getMinutes());
          newDateTime = newDate;
      } else { // time
          const [hours, minutes] = value.split(':').map(Number);
          newDateTime = new Date(currentDateTime);
          newDateTime.setHours(hours, minutes);
      }

      if(isNaN(newDateTime.getTime())) return;
      setValue(`offer.${field}`, newDateTime.toISOString());
  }

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    reset(plan as PlanFormData); // Using reset is better for forms
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingPlan(null);
    reset();
  };

  const handleDelete = (planId: string) => {
    if (!db) return;
    deleteDoc(doc(db, "plans", planId)).then(() => {
        toast({ title: "Success", description: "Plan deleted successfully." });
    }).catch((error) => {
        console.error("Error deleting plan:", error);
        toast({
            variant: "destructive",
            title: "Error",
            description: "Could not delete the plan.",
        });
    });
  };
  
  if (loading || firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white font-bold">
            {editingPlan ? <Edit /> : <PlusCircle />}
            {editingPlan ? "Edit Plan" : "Create New Plan"}
          </CardTitle>
          <CardDescription>
            {editingPlan
              ? `You are editing "${editingPlan.planName}".`
              : "Add a new investment plan for users."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planName">Plan Name</Label>
                <Input id="planName" {...register("planName")} />
                {errors.planName && <p className="text-red-500 text-sm">{errors.planName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input id="price" type="number" step="0.01" {...register("price")} />
                {errors.price && <p className="text-red-500 text-sm">{errors.price.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dailyAds">Daily Ads</Label>
                <Input id="dailyAds" type="number" {...register("dailyAds")} />
                {errors.dailyAds && <p className="text-red-500 text-sm">{errors.dailyAds.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="durationDays">Duration (Days)</Label>
                <Input id="durationDays" type="number" {...register("durationDays")} />
                {errors.durationDays && <p className="text-red-500 text-sm">{errors.durationDays.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="dailyProfit">Daily Profit ($)</Label>
                <Input id="dailyProfit" type="number" step="0.01" {...register("dailyProfit")} />
                {errors.dailyProfit && <p className="text-red-500 text-sm">{errors.dailyProfit.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="totalProfit">Total Profit ($)</Label>
                <Input id="totalProfit" type="number" step="0.01" {...register("totalProfit")} />
                {errors.totalProfit && <p className="text-red-500 text-sm">{errors.totalProfit.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                 <Controller name="status" control={control} render={({field}) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                 )} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                 <Controller name="tag" control={control} render={({field}) => (
                    <Select onValueChange={field.onChange} value={field.value || 'none'}>
                        <SelectTrigger id="tag"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {planTags.map(tag => (
                            <SelectItem key={tag.id} value={tag.name}>
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: tag.color }} />
                                    {tag.name}
                                </div>
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 )} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Controller name="visibility" control={control} render={({field}) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="visibility"><SelectValue /></SelectTrigger>
                        <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="hidden">Hidden</SelectItem>
                        </SelectContent>
                    </Select>
                )} />
              </div>
               <div className="space-y-2">
                <Label htmlFor="minPurchaseLimit">Min Purchase Limit</Label>
                <Input id="minPurchaseLimit" type="number" {...register("minPurchaseLimit")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPurchaseLimit">Max Purchase Limit</Label>
                <Input id="maxPurchaseLimit" type="number" {...register("maxPurchaseLimit")} />
              </div>
              <div className="space-y-2 md:col-span-2 lg:col-span-3">
                <Label htmlFor="description">Benefits / Details</Label>
                <Textarea id="description" {...register("description")} />
              </div>
            </div>

            {/* Plan Offer Settings */}
             <div className="space-y-4 rounded-lg border p-4 mt-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-base flex items-center gap-2"><Percent /> Limited Time Offer</Label>
                        <p className="text-sm text-muted-foreground">
                            Create a time-limited discount for this specific plan.
                        </p>
                    </div>
                    <Controller
                        name="offer.enabled"
                        control={control}
                        render={({ field }) => (
                            <Switch
                                id="offer-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </div>
                {offerEnabled && (
                    <div className="space-y-4 pt-4 border-t border-border/20">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="plan-offer-discount">Discount Percentage (%)</Label>
                                <Input
                                    id="plan-offer-discount"
                                    type="number"
                                    {...register("offer.discountPercentage")}
                                />
                            </div>
                             <div className="space-y-2 self-end">
                                <Controller
                                    name="offer.includeVipCode"
                                    control={control}
                                    render={({ field }) => (
                                         <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
                                            <Switch
                                                id="offer-vip-code"
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                            <Label htmlFor="offer-vip-code" className="flex items-center gap-2 font-normal text-base"><KeyRound/> Include Free VIP Code</Label>
                                         </div>
                                    )}
                                />
                            </div>
                        </div>

                       <div className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Start Date & Time</Label>
                                <div className="flex gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !offerStartTime && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {offerStartTime ? format(new Date(offerStartTime), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={offerStartTime ? new Date(offerStartTime) : undefined}
                                                onSelect={(date) => handleOfferDateTimeChange('startTime', date?.toISOString() || '', 'date')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="time"
                                        value={offerStartTime ? format(new Date(offerStartTime), 'HH:mm') : ''}
                                        onChange={(e) => handleOfferDateTimeChange('startTime', e.target.value, 'time')}
                                        className="w-[120px]"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>End Date & Time</Label>
                                 <div className="flex gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn("w-full justify-start text-left font-normal", !offerEndTime && "text-muted-foreground")}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {offerEndTime ? format(new Date(offerEndTime), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={offerEndTime ? new Date(offerEndTime) : undefined}
                                                onSelect={(date) => handleOfferDateTimeChange('endTime', date?.toISOString() || '', 'date')}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <Input
                                        type="time"
                                        value={offerEndTime ? format(new Date(offerEndTime), 'HH:mm') : ''}
                                        onChange={(e) => handleOfferDateTimeChange('endTime', e.target.value, 'time')}
                                        className="w-[120px]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4 pt-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="animate-spin mr-2" />}
                {editingPlan ? "Update Plan" : "Create Plan"}
              </Button>
              {editingPlan && (
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white font-bold">
            <Package /> Existing Plans
          </CardTitle>
          <CardDescription>
            List of all available investment plans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Daily Profit</TableHead>
                    <TableHead>Total Profit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => {
                    const tag = planTags.find(t => t.name === plan.tag);
                    return (
                        <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.planName}</TableCell>
                        <TableCell>${plan.price.toFixed(2)}</TableCell>
                        <TableCell>{plan.durationDays} days</TableCell>
                        <TableCell>${plan.dailyProfit.toFixed(2)}</TableCell>
                        <TableCell>${plan.totalProfit.toFixed(2)}</TableCell>
                        <TableCell>
                            <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                            {plan.status}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            {plan.tag && plan.tag !== "none" && tag && (
                            <Badge style={{ backgroundColor: tag.color }}>{plan.tag}</Badge>
                            )}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(plan)}>
                                    <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the plan.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(plan.id)} className="bg-destructive hover:bg-destructive/90">
                                        Yes, delete it
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                        </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
