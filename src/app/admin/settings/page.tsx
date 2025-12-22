
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  LoaderCircle,
  AlertTriangle,
  Coins,
  Percent,
  Calendar as CalendarIcon,
  Star,
  Trophy,
  FlipVertical,
  Palette,
  Trash2,
  PlusCircle,
  Tag,
  KeyRound,
  Wrench,
  Power,
  Eye,
  Gift,
  Contact,
  Copyright
} from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { Textarea } from "@/components/ui/textarea";
import { nanoid } from "nanoid";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle } from "@/components/ui/alert";


// --- Interface Definitions ---
interface CommanderSettings {
  weeklySalary: number;
  weeklyCpmCoins: number;
  referralRequirement: number;
}
interface DepositBoost {
  enabled: boolean;
  title: string;
  bonusPercentage: number;
  startTime: string;
  endTime: string;
  description: string;
}
interface SuperBonusTier {
  id: string;
  referrals: number;
  bonus: number;
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
interface SpinReward {
    id: string;
    label: string;
    value: number;
    type: "CASH" | "TRY_AGAIN";
    probability: number;
}
interface FlipReward {
    id: string;
    label: string;
    value: number;
    type: "CASH" | "CPM_COIN" | "NO_REWARD";
    probability: number;
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
interface SimpleFooterSettings {
    contact: string;
    copyright: string;
}

interface AdminSettings {
  maintenanceMode: boolean;
  simulatedActivityFeed: boolean;
  withdrawal: {
    open: boolean;
    startTime: string;
    endTime: string;
    offDays: string[];
  };
  depositBoost: DepositBoost;
  commander: CommanderSettings;
  superBonusTiers: SuperBonusTier[];
  spinWinRewards: SpinReward[];
  flipWinSettings: {
    cost: { usd: number, cpm: number },
    rewards: FlipReward[]
  };
  planTags: PlanTag[];
  pageCategories: PageCategory[];
  cpmPresale: CpmPresaleSettings;
}

const defaultSettings: AdminSettings = {
  maintenanceMode: false,
  simulatedActivityFeed: true,
  withdrawal: {
    open: true,
    startTime: "10:00",
    endTime: "22:00",
    offDays: ["Saturday", "Sunday"],
  },
  depositBoost: {
    enabled: false,
    title: "Limited Time Bonus!",
    bonusPercentage: 20,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    description: "Get an extra bonus on all deposits.",
  },
  commander: {
    weeklySalary: 5,
    weeklyCpmCoins: 50,
    referralRequirement: 5,
  },
  superBonusTiers: [],
  spinWinRewards: [],
  flipWinSettings: {
    cost: { usd: 2, cpm: 20 },
    rewards: [],
  },
  planTags: [],
  pageCategories: [],
  cpmPresale: { packages: [] },
};


export default function AdminSettingsPage() {
  const { db } = useFirebase();
  const [settings, setSettings] = useState<AdminSettings>(defaultSettings);
  const [footerSettings, setFooterSettings] = useState<SimpleFooterSettings>({ contact: '', copyright: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;

    const settingsDocRef = doc(db, "system", "settings");
    const unsubSettings = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSettings({ ...defaultSettings, ...data });
      } else {
        setDoc(settingsDocRef, defaultSettings);
        setSettings(defaultSettings);
      }
      setLoading(false);
    });

    const footerDocRef = doc(db, "site_footer", "content");
    const unsubFooter = onSnapshot(footerDocRef, (doc) => {
        if(doc.exists()) {
            setFooterSettings(doc.data() as SimpleFooterSettings);
        }
    });

    return () => {
        unsubSettings();
        unsubFooter();
    };
  }, [db]);

  const handleSave = () => {
    if (!settings || !db) return;
    setSaving(true);
    
    const settingsDocRef = doc(db, "system", "settings");
    const footerDocRef = doc(db, "site_footer", "content");

    const settingsPromise = setDoc(settingsDocRef, settings, { merge: true });
    const footerPromise = setDoc(footerDocRef, footerSettings, { merge: true });

    Promise.all([settingsPromise, footerPromise]).then(() => {
      toast({
        title: "Settings Saved",
        description: "All settings have been updated successfully.",
      });
    }).catch((error) => {
      console.error("Save failed:", error);
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: "Could not save the settings.",
      });
    }).finally(() => {
      setSaving(false);
    });
  };

  const handleSettingChange = (
    key: keyof AdminSettings,
    value: any
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // --- Specific change handlers for nested objects ---
  const handleWithdrawalChange = (field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      withdrawal: { ...prev.withdrawal, [field]: value },
    }));
  };
  const handleDepositBoostChange = (field: string, value: any) => {
      const currentBoost = settings.depositBoost;
      if (!currentBoost) return;

      if(field === 'startTime' || field === 'endTime') {
        const currentDateTime = new Date(currentBoost[field as 'startTime' | 'endTime']);
        const newDate = new Date(value);
        if(!isNaN(newDate.getTime())) {
            newDate.setHours(currentDateTime.getHours(), currentDateTime.getMinutes());
            setSettings(prev => ({...prev, depositBoost: {...prev.depositBoost, [field]: newDate.toISOString()}}));
        }
      } else if (field === 'startTime_time' || field === 'endTime_time') {
          const baseField = field.split('_')[0] as 'startTime' | 'endTime';
          const [hours, minutes] = value.split(':').map(Number);
          const newDateTime = new Date(currentBoost[baseField]);
          newDateTime.setHours(hours, minutes);
          setSettings(prev => ({...prev, depositBoost: {...prev.depositBoost, [baseField]: newDateTime.toISOString()}}));
      } else {
        setSettings(prev => ({...prev, depositBoost: {...prev.depositBoost, [field]: value}}));
      }
  };
  const handleCommanderChange = (field: string, value: any) => {
     setSettings((prev) => ({
      ...prev,
      commander: { ...prev.commander, [field]: Number(value) },
    }));
  }
  const handleTierChange = (id: string, field: 'referrals' | 'bonus', value: number) => {
    setSettings(prev => ({
        ...prev,
        superBonusTiers: prev.superBonusTiers.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };
  const addTier = () => {
    setSettings(prev => ({ ...prev, superBonusTiers: [...prev.superBonusTiers, {id: nanoid(), referrals: 0, bonus: 0 }]}));
  };
  const removeTier = (id: string) => {
    setSettings(prev => ({...prev, superBonusTiers: prev.superBonusTiers.filter(t => t.id !== id)}));
  };
  const handleTagChange = (id: string, field: 'name' | 'color', value: string) => {
    setSettings(prev => ({
        ...prev,
        planTags: prev.planTags.map(t => t.id === id ? { ...t, [field]: value } : t)
    }));
  };
  const addTag = () => {
    setSettings(prev => ({ ...prev, planTags: [...prev.planTags, {id: nanoid(), name: 'New Tag', color: '#808080' }]}));
  };
  const removeTag = (id: string) => {
    setSettings(prev => ({...prev, planTags: prev.planTags.filter(t => t.id !== id)}));
  };
  const handleCategoryChange = (id: string, value: string) => {
    setSettings(prev => ({
        ...prev,
        pageCategories: prev.pageCategories.map(c => c.id === id ? { ...c, name: value } : c)
    }));
  };
  const addCategory = () => {
    setSettings(prev => ({ ...prev, pageCategories: [...prev.pageCategories, {id: nanoid(), name: 'New Category' }]}));
  };
  const removeCategory = (id: string) => {
    setSettings(prev => ({...prev, pageCategories: prev.pageCategories.filter(c => c.id !== id)}));
  };

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white font-bold">
          <Settings />
          Global Settings
        </CardTitle>
        <CardDescription>
          Manage site-wide settings, features, and content from one place.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="cpm">CPM Coin</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="mt-6">
            <div className="space-y-8">
              <div className="space-y-4 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                    <Label className="text-base flex items-center gap-2 font-bold text-white"><Power/> Maintenance Mode</Label>
                    <Switch checked={settings.maintenanceMode} onCheckedChange={(v) => handleSettingChange("maintenanceMode", v)}/>
                </div>
                <p className="text-sm text-muted-foreground">When enabled, only admins can access the site. All other users will see a maintenance page.</p>
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base flex items-center gap-2 font-bold text-white"><Eye/> Simulated Activity Feed</Label>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Show a fake real-time feed of user deposits and withdrawals.</p>
                    <Switch checked={settings.simulatedActivityFeed} onCheckedChange={(v) => handleSettingChange("simulatedActivityFeed", v)}/>
                </div>
              </div>
              
              <div className="space-y-4 rounded-lg border p-4">
                <Label className="text-base flex items-center gap-2 font-bold text-white"><Wrench/> Withdrawal Settings</Label>
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Globally enable or disable withdrawal requests.</p>
                    <Switch checked={settings.withdrawal.open} onCheckedChange={(v) => handleWithdrawalChange("open", v)}/>
                </div>
                <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                        <Label htmlFor="withdrawal-start">Active Time (Start)</Label>
                        <Input id="withdrawal-start" type="time" value={settings.withdrawal.startTime} onChange={(e) => handleWithdrawalChange("startTime", e.target.value)}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="withdrawal-end">Active Time (End)</Label>
                        <Input id="withdrawal-end" type="time" value={settings.withdrawal.endTime} onChange={(e) => handleWithdrawalChange("endTime", e.target.value)}/>
                    </div>
                </div>
                <div className="space-y-2 pt-4 border-t">
                     <Label>Withdrawal Off Days</Label>
                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {daysOfWeek.map(day => (
                            <div key={day} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 border">
                                <Switch id={`day-${day}`} checked={settings.withdrawal.offDays.includes(day)}
                                 onCheckedChange={(checked) => {
                                    const currentDays = settings.withdrawal.offDays;
                                    const newDays = checked ? [...currentDays, day] : currentDays.filter(d => d !== day);
                                    handleWithdrawalChange("offDays", newDays);
                                 }}/>
                                <Label htmlFor={`day-${day}`}>{day}</Label>
                            </div>
                        ))}
                     </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="promotions" className="mt-6">
            <div className="space-y-8">
                <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                         <Label className="text-base flex items-center gap-2 font-bold text-white"><Gift/> Deposit Boost Event</Label>
                         <Switch checked={settings.depositBoost.enabled} onCheckedChange={(v) => handleDepositBoostChange("enabled", v)}/>
                    </div>
                    {settings.depositBoost.enabled && (
                        <div className="space-y-4 pt-4 border-t">
                             <div className="space-y-2">
                                <Label htmlFor="boost-title">Event Title</Label>
                                <Input id="boost-title" value={settings.depositBoost.title} onChange={(e) => handleDepositBoostChange("title", e.target.value)}/>
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="boost-desc">Description</Label>
                                <Textarea id="boost-desc" value={settings.depositBoost.description} onChange={(e) => handleDepositBoostChange("description", e.target.value)}/>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="boost-perc">Bonus Percentage (%)</Label>
                                    <Input id="boost-perc" type="number" value={settings.depositBoost.bonusPercentage} onChange={(e) => handleDepositBoostChange("bonusPercentage", Number(e.target.value))}/>
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                <Label>Start Date & Time</Label>
                                <div className="flex gap-2">
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !settings.depositBoost.startTime && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {settings.depositBoost.startTime ? format(new Date(settings.depositBoost.startTime), "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(settings.depositBoost.startTime)} onSelect={(date) => handleDepositBoostChange('startTime', date?.toISOString() || '')} initialFocus/></PopoverContent>
                                    </Popover>
                                    <Input type="time" value={format(new Date(settings.depositBoost.startTime), 'HH:mm')} onChange={(e) => handleDepositBoostChange('startTime_time', e.target.value)} className="w-[120px]"/>
                                </div>
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
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={new Date(settings.depositBoost.endTime)} onSelect={(date) => handleDepositBoostChange('endTime', date?.toISOString() || '')} initialFocus/></PopoverContent>
                                    </Popover>
                                    <Input type="time" value={format(new Date(settings.depositBoost.endTime), 'HH:mm')} onChange={(e) => handleDepositBoostChange('endTime_time', e.target.value)} className="w-[120px]"/>
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                    <Label className="text-base flex items-center gap-2 font-bold text-white"><Trophy/> Super Bonus Tiers</Label>
                    <p className="text-sm text-muted-foreground">Reward users with a one-time bonus when they reach a certain number of total team members.</p>
                     <div className="space-y-3 pt-4 border-t">
                        {settings.superBonusTiers.map((tier, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 rounded-md bg-muted/30">
                                <div className="space-y-2">
                                    <Label htmlFor={`tier-referrals-${tier.id}`}>Referral Count</Label>
                                    <Input id={`tier-referrals-${tier.id}`} type="number" value={tier.referrals} onChange={(e) => handleTierChange(tier.id, 'referrals', Number(e.target.value))} />
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor={`tier-bonus-${tier.id}`}>Bonus Amount ($)</Label>
                                    <Input id={`tier-bonus-${tier.id}`} type="number" value={tier.bonus} onChange={(e) => handleTierChange(tier.id, 'bonus', Number(e.target.value))} />
                                </div>
                                <div className="flex justify-end">
                                    <Button variant="destructive" size="icon" onClick={() => removeTier(tier.id)}><Trash2/></Button>
                                </div>
                            </div>
                        ))}
                         <Button variant="outline" onClick={addTier}><PlusCircle className="mr-2"/> Add Tier</Button>
                    </div>
                </div>
                 <div className="space-y-4 rounded-lg border p-4">
                    <Label className="text-base flex items-center gap-2 font-bold text-white"><Star/> Commander Rank Settings</Label>
                    <div className="grid md:grid-cols-3 gap-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="commander-req">Referral Requirement</Label>
                            <Input id="commander-req" type="number" value={settings.commander.referralRequirement} onChange={(e) => handleCommanderChange("referralRequirement", e.target.value)}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="commander-salary">Weekly Salary ($)</Label>
                            <Input id="commander-salary" type="number" value={settings.commander.weeklySalary} onChange={(e) => handleCommanderChange("weeklySalary", e.target.value)}/>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="commander-cpm">Weekly CPM Coins</Label>
                            <Input id="commander-cpm" type="number" value={settings.commander.weeklyCpmCoins} onChange={(e) => handleCommanderChange("weeklyCpmCoins", e.target.value)}/>
                        </div>
                    </div>
                </div>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="mt-6">
            <div className="space-y-8">
               <div className="space-y-4 rounded-lg border p-4">
                  <Label className="text-base flex items-center gap-2 font-bold text-white"><Copyright /> Footer Settings</Label>
                  <div className="space-y-4 pt-4 border-t">
                      <div className="space-y-2">
                          <Label htmlFor="footer-email">Contact Email</Label>
                          <Input id="footer-email" type="email" value={footerSettings.contact} onChange={(e) => setFooterSettings(s => ({...s, contact: e.target.value}))} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="footer-copyright">Copyright Text</Label>
                          <Textarea id="footer-copyright" value={footerSettings.copyright} onChange={(e) => setFooterSettings(s => ({...s, copyright: e.target.value}))} />
                      </div>
                  </div>
              </div>
              <div className="space-y-4 rounded-lg border p-4">
                  <Label className="text-base flex items-center gap-2 font-bold text-white"><Tag/> Plan Tags</Label>
                  <p className="text-sm text-muted-foreground">Create custom tags to display on investment plans.</p>
                   <div className="space-y-3 pt-4 border-t">
                      {settings.planTags.map((tag, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center p-3 rounded-md bg-muted/30">
                              <div className="space-y-2">
                                  <Label htmlFor={`tag-name-${tag.id}`}>Tag Name</Label>
                                  <Input id={`tag-name-${tag.id}`} value={tag.name} onChange={(e) => handleTagChange(tag.id, 'name', e.target.value)} />
                              </div>
                               <div className="space-y-2">
                                  <Label htmlFor={`tag-color-${tag.id}`}>Tag Color</Label>
                                  <div className="flex items-center gap-2 h-10 border border-input rounded-md bg-background px-3">
                                      <Palette className="h-4 w-4 text-muted-foreground"/>
                                      <Input id={`tag-color-${tag.id}`} type="color" value={tag.color} onChange={(e) => handleTagChange(tag.id, 'color', e.target.value)} className="p-0 border-0 h-8 w-8 bg-transparent"/>
                                      <span className="font-mono">{tag.color}</span>
                                  </div>
                              </div>
                              <div className="flex justify-end">
                                  <Button variant="destructive" size="icon" onClick={() => removeTag(tag.id)}><Trash2/></Button>
                              </div>
                          </div>
                      ))}
                       <Button variant="outline" onClick={addTag}><PlusCircle className="mr-2"/> Add Tag</Button>
                  </div>
              </div>
              <div className="space-y-4 rounded-lg border p-4">
                  <Label className="text-base flex items-center gap-2 font-bold text-white"><Contact/> Page Categories</Label>
                  <p className="text-sm text-muted-foreground">Manage categories for organizing footer and policy pages.</p>
                   <div className="space-y-3 pt-4 border-t">
                      {settings.pageCategories.map((cat, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 rounded-md bg-muted/30">
                              <div className="space-y-2">
                                  <Label htmlFor={`cat-name-${cat.id}`}>Category Name</Label>
                                  <Input id={`cat-name-${cat.id}`} value={cat.name} onChange={(e) => handleCategoryChange(cat.id, e.target.value)} />
                              </div>
                              <div className="flex justify-end">
                                  <Button variant="destructive" size="icon" onClick={() => removeCategory(cat.id)}><Trash2/></Button>
                              </div>
                          </div>
                      ))}
                       <Button variant="outline" onClick={addCategory}><PlusCircle className="mr-2"/> Add Category</Button>
                  </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="cpm" className="mt-6">
            <div className="space-y-8">
               <Alert>
                 <AlertTriangle className="h-4 w-4" />
                 <AlertTitle>This feature is not yet implemented.</AlertTitle>
               </Alert>
            </div>
          </TabsContent>

        </Tabs>
        
        <div className="mt-8 border-t pt-6">
          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
            Save All Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

    