
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, collection, writeBatch, getDocs, deleteDoc, serverTimestamp, updateDoc, addDoc, query, orderBy } from "firebase/firestore";
import { nanoid } from "nanoid";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, LoaderCircle, Trash2, PlusCircle, Gift, Percent, Calendar as CalendarIcon, Star, Palette, Tag, Zap, ShieldAlert, BookText, Coins, FlipVertical } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
import { useAuth } from "@/context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";


// --- Sub-Components ---

const defaultCategories = ["Legal", "Policy", "About Us", "Help", "Terms", "Privacy"];

function PageCategoriesManager({ db }: { db: any }) {
    const { toast } = useToast();
    const [pageCategories, setPageCategories] = useState<PageCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCategorySaving, setIsCategorySaving] = useState(false);

    useEffect(() => {
        if (!db) return;
        const categoriesQuery = query(collection(db, "categories"), orderBy("name", "asc"));
        const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageCategory));
            setPageCategories(cats);
        });
        return () => unsubscribeCategories();
    }, [db]);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim() || !db) return;
        setIsCategorySaving(true);
        try {
            await addDoc(collection(db, "categories"), { name: newCategoryName.trim() });
            toast({ title: "Category Added" });
            setNewCategoryName("");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not add category." });
        } finally {
            setIsCategorySaving(false);
        }
    }

    const handleAddDefaultCategories = async () => {
        if (!db) return;
        setIsCategorySaving(true);
        try {
            const existingCategories = new Set(pageCategories.map(c => c.name.toLowerCase()));
            const batch = writeBatch(db);
            let addedCount = 0;

            defaultCategories.forEach(catName => {
                if (!existingCategories.has(catName.toLowerCase())) {
                    const newCatRef = doc(collection(db, "categories"));
                    batch.set(newCatRef, { name: catName, createdAt: serverTimestamp() });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                await batch.commit();
                toast({ title: `${addedCount} Default Categories Added`, description: "The missing default categories have been added." });
            } else {
                toast({ title: "No New Categories Added", description: "All default categories already exist." });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not add default categories." });
        } finally {
            setIsCategorySaving(false);
        }
    };


    const handleDeleteCategory = async (categoryId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "categories", categoryId));
            toast({ title: "Category Deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete category." });
        }
    }

    return (
        <div className="space-y-4 rounded-lg border p-4">
            <Label className="text-base flex items-center gap-2"><BookText /> Manage Page Categories</Label>
            <p className="text-sm text-muted-foreground">Create and manage categories for website pages (e.g., Legal, Help).</p>
            <div className="space-y-4 pt-4 border-t">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                        placeholder="New category name..."
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        disabled={isCategorySaving}
                    />
                    <div className="flex gap-2">
                        <Button onClick={handleAddCategory} disabled={isCategorySaving || !newCategoryName.trim()} className="flex-1 sm:flex-grow-0">
                            {isCategorySaving ? <LoaderCircle className="animate-spin" /> : <PlusCircle />}<span className="sm:hidden ml-2">Add New</span>
                        </Button>
                        <Button onClick={handleAddDefaultCategories} disabled={isCategorySaving} variant="outline" className="flex-1 sm:flex-grow-0">
                           <span className="sm:hidden">Add Defaults</span>
                           <span className="hidden sm:inline">Add Default Categories</span>
                        </Button>
                    </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {pageCategories.map((category) => (
                        <div key={category.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                            <span className="font-medium">{category.name}</span>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will delete the "{category.name}" category.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-destructive">Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


// --- Main Settings Component ---

interface PageCategory {
    id: string;
    name: string;
}

interface AppSettings {
    footer: FooterSettings;
    maintenanceMode?: boolean;
    simulatedActivityFeed?: boolean;
    withdrawal: WithdrawalSettings;
    cpmWithdrawal: CpmWithdrawalSettings;
    depositBoost: DepositBoostEvent;
    commander: CommanderSettings;
    superBonusTiers: SuperBonusTier[];
    planTags: PlanTag[];
    cpmPresale: CpmPresaleSettings;
    spinWinSettings: SpinWinSettings;
    flipWinSettings: FlipWinSettings;
}

interface FooterSettings {
    description: string;
    contactEmail: string;
    copyrightText: string;
}

interface WithdrawalSettings {
    open: boolean;
    startTime: string;
    endTime: string;
    offDays: string[];
}

interface CpmWithdrawalSettings {
  open: boolean;
}

interface CpmCoinPackage {
  id: string;
  name: string;
  coinAmount: number;
  price: number;
  originalPrice?: number;
  tagline?: string;
  includeVipCode?: boolean;
}

interface CpmPresaleSettings {
  packages: CpmCoinPackage[];
}

interface DepositBoostEvent {
    enabled: boolean;
    title: string;
    bonusPercentage: number;
    endTime: string;
    description: string;
}

interface CommanderSettings {
    weeklySalary: number;
    weeklyCpmCoins: number;
    referralRequirement: number;
}

interface SuperBonusTier {
    id: string;
    referrals: number;
    bonus: number;
}

interface PlanTag {
    id: string;
    name: string;
    color: string;
}

type SpinRewardType = "CASH" | "TRY_AGAIN";
interface SpinReward {
    id: string; label: string; value: number; type: SpinRewardType; probability: number;
}
interface SpinWinSettings { rewards: SpinReward[] }

type FlipRewardType = "CASH" | "CPM_COIN" | "NO_REWARD";
interface FlipReward {
    id: string; label: string; value: number; type: FlipRewardType; probability: number;
}
interface FlipWinSettings { cost: { usd: number; cpm: number; }; rewards: FlipReward[]; }


const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const defaultSettings: AppSettings = {
    footer: {
        description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
        contactEmail: "tradevissionn@gmail.com",
        copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
    },
    maintenanceMode: false,
    simulatedActivityFeed: true,
    withdrawal: {
        open: true,
        startTime: "09:00",
        endTime: "17:00",
        offDays: ["Saturday", "Sunday"]
    },
    cpmWithdrawal: { open: true },
    depositBoost: {
        enabled: false,
        title: "Limited Time Boost!",
        bonusPercentage: 10,
        endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Get a bonus on all deposits made during this event."
    },
    commander: {
        weeklySalary: 50,
        weeklyCpmCoins: 10,
        referralRequirement: 50,
    },
    superBonusTiers: [
        { id: nanoid(), referrals: 10, bonus: 20 },
        { id: nanoid(), referrals: 25, bonus: 50 },
    ],
    planTags: [
        { id: nanoid(), name: "Popular", color: "#3b82f6" },
        { id: nanoid(), name: "New", color: "#10b981" },
    ],
    cpmPresale: { packages: [] },
    spinWinSettings: { rewards: [] },
    flipWinSettings: { cost: { usd: 2, cpm: 20 }, rewards: [] },
};

export default function AdminSettingsPage() {
    const { db } = useFirebase();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!db) return;

        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const mergedSettings = {
                    ...defaultSettings,
                    ...data,
                    footer: { ...defaultSettings.footer, ...(data.footer || {}) },
                    withdrawal: { ...defaultSettings.withdrawal, ...(data.withdrawal || {}) },
                    depositBoost: { ...defaultSettings.depositBoost, ...(data.depositBoost || {}) },
                    commander: { ...defaultSettings.commander, ...(data.commander || {}) },
                    cpmWithdrawal: { ...defaultSettings.cpmWithdrawal, ...(data.cpmWithdrawal || {}) },
                    superBonusTiers: data.superBonusTiers?.length ? data.superBonusTiers : defaultSettings.superBonusTiers,
                    planTags: data.planTags?.length ? data.planTags : defaultSettings.planTags,
                };
                setSettings(mergedSettings);
            } else {
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        return () => unsubscribeSettings();
    }, [db]);

    const handleSave = () => {
        if (!settings || !db) return;
        setSaving(true);
        const settingsDocRef = doc(db, "system", "settings");
        
        setDoc(settingsDocRef, settings, { merge: true }).then(() => {
            toast({
                title: "Settings Saved",
                description: "Global settings have been updated successfully.",
            });
        }).catch((error) => {
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Could not save the settings.",
            });
        }).finally(() => {
            setSaving(false);
        });
    };

    const handleBoostDateChange = (date: Date | undefined) => {
        if (!date || !settings) return;
        setSettings({ ...settings, depositBoost: { ...settings.depositBoost, endTime: date.toISOString() } });
    }

    const handleTierChange = (id: string, field: 'referrals' | 'bonus', value: number) => {
        if(!settings) return;
        const newTiers = settings.superBonusTiers.map(t => t.id === id ? {...t, [field]: value} : t);
        setSettings({ ...settings, superBonusTiers: newTiers });
    }
    const addTier = () => {
        if(!settings) return;
        const newTier = { id: nanoid(), referrals: 0, bonus: 0 };
        setSettings({ ...settings, superBonusTiers: [...settings.superBonusTiers, newTier] });
    }
    const removeTier = (id: string) => {
        if(!settings) return;
        setSettings({ ...settings, superBonusTiers: settings.superBonusTiers.filter(t => t.id !== id) });
    }
    
    const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
        if(!settings) return;
        const newTags = settings.planTags.map(t => t.id === id ? {...t, [field]: value} : t);
        setSettings({ ...settings, planTags: newTags });
    }
    const addTag = () => {
        if(!settings) return;
        const newTag = { id: nanoid(), name: "New Tag", color: "#808080" };
        setSettings({ ...settings, planTags: [...settings.planTags, newTag] });
    }
    const removeTag = (id: string) => {
        if(!settings) return;
        setSettings({ ...settings, planTags: settings.planTags.filter(t => t.id !== id) });
    }
    
    
    if(loading || !settings) {
        return <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto mt-10"/></div>
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white font-bold"><Settings/>Global Settings</CardTitle>
                    <CardDescription>Manage site-wide settings for all users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-4 rounded-lg border p-4">
                            <Label className="text-base">General</Label>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                                <Switch id="maintenance-mode" checked={settings.maintenanceMode} onCheckedChange={checked => setSettings(s => s ? ({...s, maintenanceMode: checked}) : null)} />
                            </div>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="activity-feed">Simulated Activity Feed</Label>
                                <Switch id="activity-feed" checked={settings.simulatedActivityFeed} onCheckedChange={checked => setSettings(s => s ? ({...s, simulatedActivityFeed: checked}) : null)} />
                            </div>
                        </div>

                        <div className="space-y-4 rounded-lg border p-4">
                            <Label className="text-base">Withdrawal Settings</Label>
                            <div className="flex items-center justify-between">
                                <Label htmlFor="withdrawal-open">Withdrawals Open</Label>
                                <Switch id="withdrawal-open" checked={settings.withdrawal.open} onCheckedChange={checked => setSettings(s => s ? ({...s, withdrawal: {...s.withdrawal, open: checked}}): null)} />
                            </div>
                             <div className="flex items-center justify-between">
                                <Label htmlFor="cpm-withdrawal-open">CPM Coin Withdrawals Open</Label>
                                <Switch id="cpm-withdrawal-open" checked={settings.cpmWithdrawal.open} onCheckedChange={checked => setSettings(s => s ? ({...s, cpmWithdrawal: {...s.cpmWithdrawal, open: checked}}): null)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="withdrawal-start">Start Time</Label>
                                    <Input id="withdrawal-start" type="time" value={settings.withdrawal.startTime} onChange={e => setSettings(s => s ? ({...s, withdrawal: {...s.withdrawal, startTime: e.target.value}}): null)} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="withdrawal-end">End Time</Label>
                                    <Input id="withdrawal-end" type="time" value={settings.withdrawal.endTime} onChange={e => setSettings(s => s ? ({...s, withdrawal: {...s.withdrawal, endTime: e.target.value}}): null)} />
                                </div>
                            </div>
                            <div>
                               <Label>Off Days</Label>
                               <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                                   {daysOfWeek.map(day => (
                                       <div key={day} className="flex items-center gap-2">
                                           <Switch id={`off-day-${day}`} checked={settings.withdrawal.offDays.includes(day)} onCheckedChange={checked => {
                                               const newOffDays = checked ? [...settings.withdrawal.offDays, day] : settings.withdrawal.offDays.filter(d => d !== day);
                                               setSettings(s => s ? ({...s, withdrawal: {...s.withdrawal, offDays: newOffDays}}) : null);
                                           }} />
                                           <Label htmlFor={`off-day-${day}`}>{day}</Label>
                                       </div>
                                   ))}
                               </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-4 rounded-lg border p-4">
                         <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base flex items-center gap-2"><Gift/> Deposit Boost Event</Label>
                                <p className="text-sm text-muted-foreground">Create a time-limited bonus on all user deposits.</p>
                            </div>
                            <Switch id="deposit-boost-enabled" checked={settings.depositBoost.enabled} onCheckedChange={checked => setSettings(s => s ? ({...s, depositBoost: {...s.depositBoost, enabled: checked}}): null)} />
                        </div>
                        {settings.depositBoost.enabled && (
                            <div className="space-y-4 pt-4 border-t border-border/20">
                                <div className="grid md:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <Label htmlFor="boost-title">Event Title</Label>
                                        <Input id="boost-title" value={settings.depositBoost.title} onChange={e => setSettings(s => s ? ({...s, depositBoost: {...s.depositBoost, title: e.target.value}}): null)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="boost-bonus">Bonus Percentage (%)</Label>
                                        <Input id="boost-bonus" type="number" value={settings.depositBoost.bonusPercentage} onChange={e => setSettings(s => s ? ({...s, depositBoost: {...s.depositBoost, bonusPercentage: Number(e.target.value)}}): null)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="boost-description">Description</Label>
                                    <Textarea id="boost-description" value={settings.depositBoost.description} onChange={e => setSettings(s => s ? ({...s, depositBoost: {...s.depositBoost, description: e.target.value}}): null)} />
                                </div>
                                 <div className="space-y-2">
                                    <Label>End Date</Label>
                                     <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !settings.depositBoost.endTime && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {settings.depositBoost.endTime ? format(new Date(settings.depositBoost.endTime), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(settings.depositBoost.endTime)} onSelect={handleBoostDateChange} initialFocus /></PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2"><Star/> Commander Rewards</Label>
                        <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                             <div className="space-y-2">
                                <Label htmlFor="commander-salary">Weekly Salary ($)</Label>
                                <Input id="commander-salary" type="number" value={settings.commander.weeklySalary} onChange={e => setSettings(s => s ? ({...s, commander: {...s.commander, weeklySalary: Number(e.target.value)}}): null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="commander-cpm">Weekly CPM Coins</Label>
                                <Input id="commander-cpm" type="number" value={settings.commander.weeklyCpmCoins} onChange={e => setSettings(s => s ? ({...s, commander: {...s.commander, weeklyCpmCoins: Number(e.target.value)}}): null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="commander-req">Referral Requirement</Label>
                                <Input id="commander-req" type="number" value={settings.commander.referralRequirement} onChange={e => setSettings(s => s ? ({...s, commander: {...s.commander, referralRequirement: Number(e.target.value)}}): null)} />
                            </div>
                        </div>
                    </div>
                    
                     <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2"><Zap/> Super Bonus Tiers</Label>
                        <p className="text-sm text-muted-foreground">Reward users with a one-time bonus when they reach a certain number of referrals.</p>
                        <div className="space-y-3 pt-4 border-t">
                            {settings.superBonusTiers.map((tier) => (
                                <div key={tier.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 rounded-md bg-muted/30">
                                    <div className="space-y-2">
                                        <Label htmlFor={`tier-referrals-${tier.id}`}>Referral Count</Label>
                                        <Input id={`tier-referrals-${tier.id}`} type="number" value={tier.referrals} onChange={(e) => handleTierChange(tier.id, 'referrals', Number(e.target.value))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`tier-bonus-${tier.id}`}>Bonus ($)</Label>
                                        <Input id={`tier-bonus-${tier.id}`} type="number" value={tier.bonus} onChange={(e) => handleTierChange(tier.id, 'bonus', Number(e.target.value))} />
                                    </div>
                                    <Button variant="destructive" size="icon" onClick={() => removeTier(tier.id)} className="ml-auto mt-4 md:mt-0"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addTier}><PlusCircle className="mr-2 h-4 w-4" /> Add Tier</Button>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2"><Tag/> Plan Tags</Label>
                        <p className="text-sm text-muted-foreground">Create tags that can be assigned to investment plans (e.g., 'Popular', 'Limited').</p>
                        <div className="space-y-3 pt-4 border-t">
                            {settings.planTags.map((tag) => (
                                <div key={tag.id} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 rounded-md bg-muted/30">
                                    <div className="space-y-2">
                                        <Label htmlFor={`tag-name-${tag.id}`}>Tag Name</Label>
                                        <Input id={`tag-name-${tag.id}`} value={tag.name} onChange={(e) => handleTagChange(tag.id, 'name', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`tag-color-${tag.id}`}>Color</Label>
                                        <div className="flex items-center gap-2 h-10 border border-input rounded-md bg-background px-3">
                                            <Palette className="h-5 w-5 text-muted-foreground"/>
                                            <Input id={`tag-color-${tag.id}`} type="color" value={tag.color} onChange={(e) => handleTagChange(tag.id, 'color', e.target.value)} className="p-0 border-0 h-8 w-8 bg-transparent" />
                                            <span className="font-mono">{tag.color}</span>
                                        </div>
                                    </div>
                                    <Button variant="destructive" size="icon" onClick={() => removeTag(tag.id)} className="ml-auto mt-4 md:mt-0"><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addTag}><PlusCircle className="mr-2 h-4 w-4" /> Add Tag</Button>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2">Footer Settings</Label>
                        <p className="text-sm text-muted-foreground">Edit the content displayed in the website footer.</p>
                        <div className="space-y-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="footer-desc">Description</Label>
                                <Textarea id="footer-desc" value={settings.footer.description} onChange={(e) => setSettings(s => s ? ({...s, footer: {...s.footer, description: e.target.value}}): null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="footer-email">Contact Email</Label>
                                <Input id="footer-email" type="email" value={settings.footer.contactEmail} onChange={(e) => setSettings(s => s ? ({...s, footer: {...s.footer, contactEmail: e.target.value}}): null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="footer-copyright">Copyright Text</Label>
                                <Input id="footer-copyright" value={settings.footer.copyrightText} onChange={(e) => setSettings(s => s ? ({...s, footer: {...s.footer, copyrightText: e.target.value}}): null)} />
                            </div>
                        </div>
                    </div>

                    <PageCategoriesManager db={db} />
                    
                    <Button onClick={handleSave} disabled={saving} size="lg">
                        {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Save All Settings
                    </Button>
                </CardContent>
            </Card>
        </>
    );
}
