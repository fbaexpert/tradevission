
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, collection, writeBatch, getDocs, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, LoaderCircle, Trash2, PlusCircle, Gift, Percent, Calendar as CalendarIcon, Star, Palette, Tag, Zap, ShieldAlert, BookText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFirebase } from "@/lib/firebase/provider";
import { nanoid } from "nanoid";
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
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/context/auth-context";
import { reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";


interface WithdrawalSettings {
    open: boolean;
    startTime: string;
    endTime: string;
    offDays: string[];
}

interface CommanderSettings {
    weeklySalary: number;
    weeklyCpmCoins: number;
    referralRequirement: number;
}

interface SuperBonusTier {
    referrals: number;
    bonus: number;
}

interface PlanTag {
    id: string;
    name: string;
    color: string;
}

interface PageCategory {
    id: string;
    name: string;
}

interface DepositBoostEvent {
    enabled: boolean;
    title: string;
    bonusPercentage: number;
    endTime: string;
    description: string;
}

interface FooterSettings {
    description: string;
    contactEmail: string;
    copyrightText: string;
}

interface AppSettings {
    supportEmail: string;
    maintenanceMode: boolean;
    simulatedActivityFeed: boolean;
    withdrawal: WithdrawalSettings;
    superBonusTiers: SuperBonusTier[];
    commander: CommanderSettings;
    planTags?: PlanTag[];
    pageCategories?: PageCategory[];
    depositBoost?: DepositBoostEvent;
    footer: FooterSettings;
}

const ALL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const defaultSettings: AppSettings = {
    supportEmail: "tradevissionn@gmail.com",
    maintenanceMode: false,
    simulatedActivityFeed: true,
    withdrawal: {
        open: true,
        startTime: "08:00",
        endTime: "20:00",
        offDays: ["Saturday", "Sunday"],
    },
    commander: {
        weeklySalary: 12,
        weeklyCpmCoins: 5,
        referralRequirement: 50,
    },
    superBonusTiers: [
        { referrals: 10, bonus: 5 },
        { referrals: 20, bonus: 10 },
        { referrals: 50, bonus: 20 },
    ],
    planTags: [
        { id: nanoid(), name: "Popular", color: "#3b82f6" },
        { id: nanoid(), name: "Limited", color: "#f59e0b" },
        { id: nanoid(), name: "Best Seller", color: "#8b5cf6" },
    ],
    pageCategories: [
        { id: nanoid(), name: "Legal" },
        { id: nanoid(), name: "Policies" },
        { id: nanoid(), name: "Help" },
        { id: nanoid(), name: "About" },
    ],
    depositBoost: {
        enabled: false,
        title: "Deposit Boost Active!",
        bonusPercentage: 10,
        endTime: new Date().toISOString(),
        description: "Get a bonus on all deposits for a limited time.",
    },
    footer: {
        description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
        contactEmail: "tradevissionn@gmail.com",
        copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
    }
};

const COLLECTIONS_TO_DELETE = [
    "activityLogs",
    "adminAlerts",
    "airdrops",
    "announcements",
    "cpm_purchase_logs",
    "cpmWithdrawals",
    "deposits",
    "feedback",
    "kycSubmissions",
    "notification_logs",
    "supportTickets",
    "userPlans",
    "vipCodes",
    "vipMailbox",
    "withdrawals",
];


export default function AdminSettingsPage() {
    const { user } = useAuth();
    const { db, auth } = useFirebase();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
    const [resetPassword, setResetPassword] = useState("");
    const [resetTypedConfirm, setResetTypedConfirm] = useState("");
    const [isCountdownActive, setIsCountdownActive] = useState(false);
    const [countdown, setCountdown] = useState(60);
    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (!db) return;

        const settingsDocRef = doc(db, "system", "settings");

        const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                
                const mergedSettings: AppSettings = {
                    ...defaultSettings,
                    ...data,
                    withdrawal: { ...defaultSettings.withdrawal, ...(data.withdrawal || {}) },
                    commander: { ...defaultSettings.commander, ...(data.commander || {}) },
                    superBonusTiers: data.superBonusTiers && data.superBonusTiers.length > 0 ? data.superBonusTiers : defaultSettings.superBonusTiers,
                    planTags: data.planTags && data.planTags.length > 0 ? data.planTags : defaultSettings.planTags,
                    pageCategories: data.pageCategories && data.pageCategories.length > 0 ? data.pageCategories : defaultSettings.pageCategories,
                    depositBoost: { ...defaultSettings.depositBoost!, ...(data.depositBoost || {}) },
                    footer: { ...defaultSettings.footer, ...(data.footer || {}) }
                };
                
                if (!mergedSettings.depositBoost!.endTime) mergedSettings.depositBoost!.endTime = new Date().toISOString();
                setSettings(mergedSettings);
            } else {
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);
    
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isCountdownActive && countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        } else if (isCountdownActive && countdown === 0) {
            handleFinalReset();
        }
        return () => clearTimeout(timer);
    }, [isCountdownActive, countdown]);

    const handleSave = () => {
        if (!settings || !db) return;
        setSaving(true);
        const settingsDocRef = doc(db, "system", "settings");
        
        // Filter out any empty categories before saving
        const cleanedSettings = {
            ...settings,
            pageCategories: settings.pageCategories?.filter(cat => cat.name.trim() !== '')
        };

        setDoc(settingsDocRef, cleanedSettings, { merge: true }).then(() => {
            toast({
                title: "Settings Saved",
                description: "Global settings have been updated successfully.",
            });
        }).catch((error) => {
            console.error("Error saving settings:", error);
            toast({
                variant: "destructive",
                title: "Save Failed",
                description: "Could not save the settings.",
            });
        }).finally(() => {
            setSaving(false);
        });
    };

    const handleStartResetCountdown = async () => {
        if (!user || !user.email) {
            toast({ variant: "destructive", title: "Authentication Error", description: "Cannot verify your identity."});
            return;
        }
        if(resetTypedConfirm !== 'RESET') {
            toast({ variant: "destructive", title: "Confirmation Failed", description: "You must type 'RESET' to confirm."});
            return;
        }
        setIsResetting(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, resetPassword);
            await reauthenticateWithCredential(user, credential);
            setIsResetConfirmOpen(false);
            setIsCountdownActive(true);
            toast({ title: "Countdown Started", description: "System reset will begin in 60 seconds. You can still cancel."});
        } catch (error) {
            toast({ variant: "destructive", title: "Authentication Failed", description: "Incorrect password. Reset has been cancelled."});
            setIsResetting(false);
        }
    }
    
    const handleFinalReset = async () => {
        if (!db || !user) return;
        setIsResetting(true);
        setIsCountdownActive(false);
        toast({ title: "System Reset In Progress...", description: "This may take a few moments. Do not close this page." });
        try {
            const logRef = doc(collection(db, "admin_reset_logs"));
            await setDoc(logRef, {
                adminId: user.uid,
                adminEmail: user.email,
                resetAt: serverTimestamp(),
                collectionsDeleted: COLLECTIONS_TO_DELETE
            });
            for (const collectionName of COLLECTIONS_TO_DELETE) {
                const querySnapshot = await getDocs(collection(db, collectionName));
                if(querySnapshot.empty) continue;
                const deleteBatch = writeBatch(db);
                querySnapshot.docs.forEach(doc => {
                    deleteBatch.delete(doc.ref);
                });
                await deleteBatch.commit();
            }
            toast({ title: "✅ System Reset Complete", description: "Specified user data has been cleared from the database." });
            setResetPassword("");
            setResetTypedConfirm("");
            setIsResetting(false);
        } catch (error: any) {
            console.error("EMERGENCY RESET FAILED:", error);
            toast({ variant: "destructive", title: "RESET FAILED", description: error.message || "An unexpected error occurred during the reset process." });
            setIsResetting(false);
        }
    };
    
    const cancelCountdown = () => {
        setIsCountdownActive(false);
        setCountdown(60);
        setIsResetting(false);
        setResetPassword("");
        setResetTypedConfirm("");
        toast({ title: "Reset Cancelled", description: "The system reset has been cancelled." });
    };

    const handleWithdrawalDayToggle = (day: string, checked: boolean) => {
        if (!settings) return;
        const currentOffDays = settings.withdrawal.offDays || [];
        const newOffDays = checked ? [...currentOffDays, day] : currentOffDays.filter(d => d !== day);
        setSettings({ ...settings, withdrawal: { ...settings.withdrawal, offDays: newOffDays } });
    }

    const handleBonusTierChange = (index: number, field: keyof SuperBonusTier, value: string) => {
        if (!settings || !settings.superBonusTiers) return;
        const newTiers = [...settings.superBonusTiers];
        const numValue = Number(value);
        if(!isNaN(numValue) && numValue >= 0) {
            newTiers[index] = { ...newTiers[index], [field]: numValue };
            setSettings({ ...settings, superBonusTiers: newTiers });
        }
    };

    const addBonusTier = () => {
        if (!settings) return;
        const newTiers = settings.superBonusTiers ? [...settings.superBonusTiers] : [];
        newTiers.push({ referrals: 0, bonus: 0 });
        setSettings({ ...settings, superBonusTiers: newTiers });
    };

    const removeBonusTier = (index: number) => {
        if (!settings || !settings.superBonusTiers) return;
        const newTiers = settings.superBonusTiers.filter((_, i) => i !== index);
        setSettings({ ...settings, superBonusTiers: newTiers });
    };

    const handleOfferDateTimeChange = (field: 'endTime', value: string, type: 'date' | 'time') => {
        if (!settings || !value || !settings.depositBoost) return;
        const currentOffer = settings.depositBoost;
        const currentDateTime = currentOffer[field] ? new Date(currentOffer[field]) : new Date();
        let newDateTime;
        if (type === 'date') {
            const newDate = new Date(value);
            if(isNaN(newDate.getTime())) return;
            newDate.setHours(currentDateTime.getHours());
            newDate.setMinutes(currentDateTime.getMinutes());
            newDateTime = newDate;
        } else {
            const [hours, minutes] = value.split(':').map(Number);
            newDateTime = new Date(currentDateTime);
            newDateTime.setHours(hours);
            newDateTime.setMinutes(minutes);
        }
        if(isNaN(newDateTime.getTime())) return;
        setSettings({ ...settings, depositBoost: { ...currentOffer, [field]: newDateTime.toISOString() } });
    }

    const handlePlanTagChange = (index: number, field: keyof PlanTag, value: string) => {
        if (!settings) return;
        const newTags = [...(settings.planTags || [])];
        newTags[index] = { ...newTags[index], [field]: value };
        setSettings({ ...settings, planTags: newTags });
    };

    const addPlanTag = () => {
        if (!settings) return;
        const newTags = [...(settings.planTags || [])];
        newTags.push({ id: nanoid(), name: "New Tag", color: "#808080" });
        setSettings({ ...settings, planTags: newTags });
    };

    const removePlanTag = (index: number) => {
        if (!settings) return;
        const newTags = (settings.planTags || []).filter((_, i) => i !== index);
        setSettings({ ...settings, planTags: newTags });
    };

    const handlePageCategoryChange = (index: number, value: string) => {
        if (!settings) return;
        const newCategories = [...(settings.pageCategories || [])];
        newCategories[index] = { ...newCategories[index], name: value };
        setSettings({ ...settings, pageCategories: newCategories });
    };

    const addPageCategory = () => {
        if (!settings) return;
        const newCategories = [...(settings.pageCategories || [])];
        newCategories.push({ id: nanoid(), name: "" });
        setSettings({ ...settings, pageCategories: newCategories });
    };

    const removePageCategory = (index: number) => {
        if (!settings) return;
        const newCategories = (settings.pageCategories || []).filter((_, i) => i !== index);
        setSettings({ ...settings, pageCategories: newCategories });
    };
    
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
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="maintenance-mode" className="text-base">Website Paused</Label>
                            <p className="text-sm text-muted-foreground">
                                When enabled, only admins can log in. All other users will see a maintenance page.
                            </p>
                        </div>
                        <Switch id="maintenance-mode" checked={settings.maintenanceMode} onCheckedChange={(checked) => setSettings(s => s ? ({ ...s, maintenanceMode: checked }) : null)} />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="simulated-activity" className="text-base">Simulated Activity Feed</Label>
                            <p className="text-sm text-muted-foreground">Show a simulated feed of deposits and withdrawals to users.</p>
                        </div>
                        <Switch id="simulated-activity" checked={settings.simulatedActivityFeed} onCheckedChange={(checked) => setSettings(s => s ? ({ ...s, simulatedActivityFeed: checked }) : null)} />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="support-email">Support Email</Label>
                        <Input id="support-email" type="email" value={settings.supportEmail} onChange={(e) => setSettings(s => s ? ({ ...s, supportEmail: e.target.value }) : null)} placeholder="e.g., support@example.com" />
                        <p className="text-sm text-muted-foreground">This email will be displayed to users for support inquiries.</p>
                    </div>

                    {/* Footer Settings */}
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2">Footer Settings</Label>
                            <p className="text-sm text-muted-foreground">Edit the content displayed in the website footer.</p>
                        </div>
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
                     
                    {/* Page Categories Settings */}
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2"><BookText /> Manage Page Categories</Label>
                        <p className="text-sm text-muted-foreground">Create and manage categories for website pages (e.g., Legal, Help).</p>
                        <div className="space-y-2 pt-2 border-t">
                            {(settings.pageCategories || []).map((category, index) => (
                                <div key={category.id} className="flex items-center gap-2">
                                    <Input 
                                        type="text" 
                                        placeholder="Category Name" 
                                        value={category.name}
                                        onChange={(e) => handlePageCategoryChange(index, e.target.value)}
                                    />
                                    <Button variant="destructive" size="icon" onClick={() => removePageCategory(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addPageCategory}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Add Category
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border border-primary/50 bg-primary/10 p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base flex items-center gap-2 text-primary"><Zap /> Deposit Boost Event</Label>
                                <p className="text-sm text-primary/80">Temporarily boost all user deposits with a percentage bonus.</p>
                            </div>
                            <Switch id="deposit-boost-enabled" checked={settings.depositBoost?.enabled} onCheckedChange={(checked) => setSettings(s => s ? ({ ...s, depositBoost: {...s.depositBoost!, enabled: checked} }) : null)} />
                        </div>
                        {settings.depositBoost?.enabled && (
                            <div className="space-y-4 pt-4 border-t border-primary/20">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="deposit-boost-title">Event Title</Label>
                                        <Input id="deposit-boost-title" value={settings.depositBoost.title} onChange={(e) => setSettings(s => s ? ({ ...s, depositBoost: {...s.depositBoost!, title: e.target.value} }) : null)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="deposit-boost-bonus">Bonus Percentage (%)</Label>
                                        <Input id="deposit-boost-bonus" type="number" value={settings.depositBoost.bonusPercentage} onChange={(e) => setSettings(s => s ? ({ ...s, depositBoost: {...s.depositBoost!, bonusPercentage: Number(e.target.value)} }) : null)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="deposit-boost-description">Event Description</Label>
                                    <Textarea id="deposit-boost-description" value={settings.depositBoost.description} onChange={(e) => setSettings(s => s ? ({ ...s, depositBoost: {...s.depositBoost!, description: e.target.value} }) : null)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>End Date & Time</Label>
                                    <div className="flex gap-2">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !settings.depositBoost.endTime && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {settings.depositBoost.endTime ? format(new Date(settings.depositBoost.endTime), "PPP") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0">
                                                <Calendar mode="single" selected={settings.depositBoost.endTime ? new Date(settings.depositBoost.endTime) : undefined} onSelect={(date) => handleOfferDateTimeChange('endTime', date?.toISOString() || '', 'date')} initialFocus />
                                            </PopoverContent>
                                        </Popover>
                                        <Input type="time" value={format(new Date(settings.depositBoost.endTime), 'HH:mm')} onChange={(e) => handleOfferDateTimeChange('endTime', e.target.value, 'time')} className="w-[120px]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base flex items-center gap-2"><Tag /> Manage Plan Tags</Label>
                                <p className="text-sm text-muted-foreground">Create and manage custom tags for investment plans.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {(settings.planTags || []).map((tag, index) => (
                                <div key={tag.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                    <Input type="text" placeholder="Tag Name" value={tag.name} onChange={(e) => handlePlanTagChange(index, 'name', e.target.value)} className="w-40" />
                                    <div className="flex items-center gap-2 h-10 border border-input rounded-md bg-background px-3">
                                        <Palette className="h-4 w-4 text-muted-foreground"/>
                                        <Input id="badge-color" type="color" value={tag.color} onChange={(e) => handlePlanTagChange(index, 'color', e.target.value)} className="p-0 border-0 h-8 w-8 bg-transparent" />
                                    </div>
                                    <Button variant="destructive" size="icon" onClick={() => removePlanTag(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addPlanTag}><PlusCircle className="mr-2 h-4 w-4" />Add Plan Tag</Button>
                        </div>
                    </div>
                    
                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="withdrawal-open" className="text-base">Withdrawals Enabled</Label>
                                <p className="text-sm text-muted-foreground">Globally enable or disable all user withdrawals.</p>
                            </div>
                            <Switch id="withdrawal-open" checked={settings.withdrawal.open} onCheckedChange={(checked) => setSettings(s => s ? ({ ...s, withdrawal: {...s.withdrawal, open: checked} }) : null)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Withdrawal Active Time (Server Time)</Label>
                            <div className="flex items-center gap-4">
                                <Input type="time" value={settings.withdrawal.startTime} onChange={(e) => setSettings(s => s ? ({ ...s, withdrawal: {...s.withdrawal, startTime: e.target.value} }) : null)} />
                                <span>to</span>
                                <Input type="time" value={settings.withdrawal.endTime} onChange={(e) => setSettings(s => s ? ({ ...s, withdrawal: {...s.withdrawal, endTime: e.target.value} }) : null)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Withdrawal Off Days</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {ALL_DAYS.map(day => (
                                    <div key={day} className="flex items-center gap-2">
                                        <Checkbox id={`day-${day}`} checked={settings.withdrawal.offDays.includes(day)} onCheckedChange={(checked) => handleWithdrawalDayToggle(day, !!checked)} />
                                        <Label htmlFor={`day-${day}`} className="font-normal">{day}</Label>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label className="text-base flex items-center gap-2"><Star /> Commander Program</Label>
                            <p className="text-sm text-muted-foreground">Configure the rewards and requirements for the Commander rank.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                            <div className="space-y-2">
                                <Label htmlFor="commander-referrals">Referral Requirement</Label>
                                <Input id="commander-referrals" type="number" value={settings.commander.referralRequirement} onChange={(e) => setSettings(s => s ? ({ ...s, commander: {...s.commander, referralRequirement: Number(e.target.value)} }) : null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="commander-salary">Weekly Salary (Points)</Label>
                                <Input id="commander-salary" type="number" value={settings.commander.weeklySalary} onChange={(e) => setSettings(s => s ? ({ ...s, commander: {...s.commander, weeklySalary: Number(e.target.value)} }) : null)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="commander-coins">Weekly CPM Coins</Label>
                                <Input id="commander-coins" type="number" value={settings.commander.weeklyCpmCoins} onChange={(e) => setSettings(s => s ? ({ ...s, commander: {...s.commander, weeklyCpmCoins: Number(e.target.value)} }) : null)} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base flex items-center gap-2"><Gift /> Super Bonus Settings</Label>
                                <p className="text-sm text-muted-foreground">Reward users for reaching referral milestones.</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {(settings.superBonusTiers || []).map((tier, index) => (
                                <div key={index} className="flex items-center gap-4 p-2 rounded-md bg-muted/30">
                                    <Label>Tier {index + 1}</Label>
                                    <Input type="number" placeholder="Referrals" value={tier.referrals} onChange={(e) => handleBonusTierChange(index, 'referrals', e.target.value)} className="w-32" />
                                    <Input type="number" placeholder="Bonus (Points)" value={tier.bonus} onChange={(e) => handleBonusTierChange(index, 'bonus', e.target.value)} className="w-32" />
                                    <Button variant="destructive" size="icon" onClick={() => removeBonusTier(index)}><Trash2 className="h-4 w-4" /></Button>
                                </div>
                            ))}
                            <Button variant="outline" onClick={addBonusTier}><PlusCircle className="mr-2 h-4 w-4" />Add Tier</Button>
                        </div>
                    </div>

                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Changes
                    </Button>
                </CardContent>
            </Card>
            
            <Card className="border-destructive/50 bg-destructive/10">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert/> Emergency Actions</CardTitle>
                    <CardDescription className="text-destructive/80">Use these actions only in critical situations. These actions are irreversible.</CardDescription>
                </CardHeader>
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive">Emergency System Reset</Button></AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>ARE YOU ABSOLUTELY SURE?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This is an irreversible action that will delete most user-generated data from the database, including user plans, deposits, withdrawals, tickets, and logs.
                                    <strong className="block mt-2">This CANNOT be undone.</strong>
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => setIsResetConfirmOpen(true)} className="bg-destructive hover:bg-destructive/90">I Understand, Continue</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Final Confirmation: System Reset</DialogTitle>
                        <DialogDescription>To proceed, please type 'RESET' and enter your admin password. The reset will begin after a 60-second countdown.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reset-confirm-text">Type "RESET" to confirm</Label>
                            <Input id="reset-confirm-text" value={resetTypedConfirm} onChange={(e) => setResetTypedConfirm(e.target.value)} placeholder="RESET" className="font-mono tracking-widest" disabled={isResetting} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reset-password">Your Admin Password</Label>
                            <Input id="reset-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="••••••••" disabled={isResetting} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsResetConfirmOpen(false)} disabled={isResetting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleStartResetCountdown} disabled={isResetting || !resetPassword || resetTypedConfirm !== 'RESET'}>
                            {isResetting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                            Initiate Reset
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            
            <Dialog open={isCountdownActive}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-destructive text-center">SYSTEM RESET IN PROGRESS</DialogTitle>
                        <DialogDescription className="text-center">All specified collections will be deleted in...</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center items-center py-8">
                        <div className="text-8xl font-mono font-bold text-destructive">{countdown}</div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" className="w-full" onClick={cancelCountdown}>CANCEL RESET</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
