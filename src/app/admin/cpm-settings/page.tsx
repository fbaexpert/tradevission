
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { nanoid } from "nanoid";
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
  LoaderCircle,
  Percent,
  Calendar as CalendarIcon,
  Coins,
  KeyRound,
  Trash2,
  PlusCircle
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useFirebase } from "@/lib/firebase/provider";

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

interface CpmCoinOffer {
  enabled: boolean;
  title: string;
  bonusPercentage: number;
  startTime: string;
  endTime: string;
  description: string;
  includeVipCode?: boolean;
}

interface CpmSettings {
  cpmWithdrawal: CpmWithdrawalSettings;
  cpmPresale: CpmPresaleSettings;
  cpmCoinOffer: CpmCoinOffer;
}

const defaultSettings: CpmSettings = {
  cpmWithdrawal: {
    open: true,
  },
  cpmPresale: {
    packages: [
        { id: nanoid(), name: "Starter Pack", coinAmount: 100, price: 10, tagline: "Get Started" },
        { id: nanoid(), name: "Investor Bundle", coinAmount: 550, price: 50, originalPrice: 55, tagline: "Most Popular", includeVipCode: true },
        { id: nanoid(), name: "Whale Tier", coinAmount: 1200, price: 100, originalPrice: 120, tagline: "Best Value", includeVipCode: true },
    ]
  },
  cpmCoinOffer: {
    enabled: false,
    title: "Limited Time Offer!",
    bonusPercentage: 10,
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    description: "Get a 10% bonus on all CPM Coin purchases for a limited time.",
    includeVipCode: false,
  },
};

export default function AdminCpmSettingsPage() {
  const { db } = useFirebase();
  const [settings, setSettings] = useState<CpmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!db) return;

    const settingsDocRef = doc(db, "system", "settings");

    const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();

        const mergedSettings: CpmSettings = {
          cpmWithdrawal: {
            ...defaultSettings.cpmWithdrawal,
            ...(data.cpmWithdrawal || {}),
          },
          cpmPresale: {
            ...defaultSettings.cpmPresale,
            ...(data.cpmPresale || {}),
          },
          cpmCoinOffer: {
            ...defaultSettings.cpmCoinOffer,
            ...(data.cpmCoinOffer || {}),
          },
        };
        
        if (!mergedSettings.cpmPresale.packages || mergedSettings.cpmPresale.packages.length === 0) {
            mergedSettings.cpmPresale.packages = defaultSettings.cpmPresale.packages;
        }

        if (!mergedSettings.cpmCoinOffer.startTime)
          mergedSettings.cpmCoinOffer.startTime = new Date().toISOString();
        if (!mergedSettings.cpmCoinOffer.endTime)
          mergedSettings.cpmCoinOffer.endTime = new Date().toISOString();

        setSettings(mergedSettings);
      } else {
        const initialSettings = {
          cpmWithdrawal: defaultSettings.cpmWithdrawal,
          cpmPresale: defaultSettings.cpmPresale,
          cpmCoinOffer: defaultSettings.cpmCoinOffer,
        };
        setDoc(settingsDocRef, initialSettings);
        setSettings(initialSettings);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleSave = () => {
    if (!settings || !db) return;
    setSaving(true);
    const settingsDocRef = doc(db, "system", "settings");

    setDoc(settingsDocRef, settings, { merge: true })
      .then(() => {
        toast({
          title: "Settings Saved",
          description: "CPM Coin settings have been updated successfully.",
        });
      })
      .catch((error) => {
        console.error("Error saving settings:", error);
        toast({
          variant: "destructive",
          title: "Save Failed",
          description: "Could not save the CPM Coin settings.",
        });
      })
      .finally(() => {
        setSaving(false);
      });
  };
  
    const handlePackageChange = (id: string, field: keyof CpmCoinPackage, value: string | number | boolean) => {
        if (!settings) return;
        const newPackages = settings.cpmPresale.packages.map(pkg => {
            if (pkg.id === id) {
                return { ...pkg, [field]: value };
            }
            return pkg;
        });
        setSettings({ ...settings, cpmPresale: { ...settings.cpmPresale, packages: newPackages } });
    };

    const addPackage = () => {
        if (!settings) return;
        const newPackage: CpmCoinPackage = { id: nanoid(), name: "New Package", coinAmount: 0, price: 0 };
        setSettings({ ...settings, cpmPresale: { ...settings.cpmPresale, packages: [...settings.cpmPresale.packages, newPackage] } });
    };

    const removePackage = (id: string) => {
        if (!settings) return;
        const newPackages = settings.cpmPresale.packages.filter(pkg => pkg.id !== id);
        setSettings({ ...settings, cpmPresale: { ...settings.cpmPresale, packages: newPackages } });
    };


  const handleOfferDateTimeChange = (
    field: "startTime" | "endTime",
    value: string,
    type: "date" | "time"
  ) => {
    if (!settings || !value) return;

    const currentOffer = settings.cpmCoinOffer;

    const currentDateTime = currentOffer[field]
      ? new Date(currentOffer[field])
      : new Date();

    let newDateTime;

    if (type === "date") {
      const newDate = new Date(value);
      if (isNaN(newDate.getTime())) return;
      newDate.setHours(currentDateTime.getHours());
      newDate.setMinutes(currentDateTime.getMinutes());
      newDateTime = newDate;
    } else {
      // time
      const [hours, minutes] = value.split(":").map(Number);
      newDateTime = new Date(currentDateTime);
      newDateTime.setHours(hours);
      newDateTime.setMinutes(minutes);
    }

    if (isNaN(newDateTime.getTime())) return;

    setSettings({
      ...settings,
      cpmCoinOffer: {
        ...currentOffer,
        [field]: newDateTime.toISOString(),
      },
    });
  };

  if (loading || !settings) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="animate-spin mx-auto mt-10" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white font-bold">
          <Coins />
          CPM Coin Settings
        </CardTitle>
        <CardDescription>
          Manage all settings related to CPM Coin, including pricing, offers,
          and withdrawals.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* CPM Coin Pre-Sale Settings */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base flex items-center gap-2">
              Pre-Sale Packages
            </Label>
            <p className="text-sm text-muted-foreground">
              Create and manage the packages available for users to purchase.
            </p>
          </div>
          <div className="space-y-4 pt-4 border-t">
              {settings.cpmPresale.packages.map((pkg) => (
                  <div key={pkg.id} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-center p-3 rounded-md bg-muted/30">
                      <div className="space-y-2">
                          <Label htmlFor={`pkg-name-${pkg.id}`}>Package Name</Label>
                          <Input id={`pkg-name-${pkg.id}`} value={pkg.name} onChange={(e) => handlePackageChange(pkg.id, 'name', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`pkg-coins-${pkg.id}`}>Coin Amount</Label>
                          <Input id={`pkg-coins-${pkg.id}`} type="number" value={pkg.coinAmount} onChange={(e) => handlePackageChange(pkg.id, 'coinAmount', Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`pkg-price-${pkg.id}`}>Price ($)</Label>
                          <Input id={`pkg-price-${pkg.id}`} type="number" value={pkg.price} onChange={(e) => handlePackageChange(pkg.id, 'price', Number(e.target.value))} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`pkg-oprice-${pkg.id}`}>Original Price (Optional)</Label>
                          <Input id={`pkg-oprice-${pkg.id}`} type="number" value={pkg.originalPrice || ''} onChange={(e) => handlePackageChange(pkg.id, 'originalPrice', Number(e.target.value))} placeholder="e.g. 60" />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`pkg-tagline-${pkg.id}`}>Tagline (Optional)</Label>
                          <Input id={`pkg-tagline-${pkg.id}`} value={pkg.tagline || ''} onChange={(e) => handlePackageChange(pkg.id, 'tagline', e.target.value)} placeholder="e.g., Best Value" />
                      </div>
                      <div className="flex items-center justify-between pt-4 lg:pt-0">
                          <div className="flex items-center gap-2">
                              <Switch id={`pkg-vip-${pkg.id}`} checked={pkg.includeVipCode} onCheckedChange={(checked) => handlePackageChange(pkg.id, 'includeVipCode', checked)} />
                              <Label htmlFor={`pkg-vip-${pkg.id}`} className="flex items-center gap-1 font-normal text-xs"><KeyRound size={14}/> VIP</Label>
                          </div>
                          <Button variant="destructive" size="icon" onClick={() => removePackage(pkg.id)}>
                              <Trash2 className="h-4 w-4" />
                          </Button>
                      </div>
                  </div>
              ))}
              <Button variant="outline" onClick={addPackage}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Package
              </Button>
          </div>
        </div>

        {/* CPM Withdrawal Settings */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label
                htmlFor="cpm-withdrawal-open"
                className="text-base flex items-center gap-2"
              >
                CPM Coin Withdrawals
              </Label>
              <p className="text-sm text-muted-foreground">
                Globally enable or disable all CPM Coin withdrawals.
              </p>
            </div>
            <Switch
              id="cpm-withdrawal-open"
              checked={settings.cpmWithdrawal.open}
              onCheckedChange={(checked) =>
                setSettings(
                  (s) =>
                    s
                      ? {
                          ...s,
                          cpmWithdrawal: { ...s.cpmWithdrawal, open: checked },
                        }
                      : null
                )
              }
            />
          </div>
        </div>

        {/* CPM Coin Offer Settings */}
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base flex items-center gap-2">
                <Percent /> Purchase Offer
              </Label>
              <p className="text-sm text-muted-foreground">
                Create a time-limited bonus offer for CPM Coin purchases.
              </p>
            </div>
            <Switch
              id="cpm-offer-enabled"
              checked={settings.cpmCoinOffer?.enabled}
              onCheckedChange={(checked) =>
                setSettings(
                  (s) =>
                    s
                      ? {
                          ...s,
                          cpmCoinOffer: {
                            ...s.cpmCoinOffer,
                            enabled: checked,
                          },
                        }
                      : null
                )
              }
            />
          </div>
          {settings.cpmCoinOffer?.enabled && (
            <div className="space-y-4 pt-4 border-t border-border/20">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offer-title">Offer Title</Label>
                  <Input
                    id="offer-title"
                    value={settings.cpmCoinOffer.title}
                    onChange={(e) =>
                      setSettings(
                        (s) =>
                          s
                            ? {
                                ...s,
                                cpmCoinOffer: {
                                  ...s.cpmCoinOffer,
                                  title: e.target.value,
                                },
                              }
                            : null
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-bonus">Bonus Percentage (%)</Label>
                  <Input
                    id="offer-bonus"
                    type="number"
                    value={settings.cpmCoinOffer.bonusPercentage}
                    onChange={(e) =>
                      setSettings(
                        (s) =>
                          s
                            ? {
                                ...s,
                                cpmCoinOffer: {
                                  ...s.cpmCoinOffer,
                                  bonusPercentage: Number(e.target.value),
                                },
                              }
                            : null
                      )
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-description">Offer Description</Label>
                <Textarea
                  id="offer-description"
                  value={settings.cpmCoinOffer.description}
                  onChange={(e) =>
                    setSettings(
                      (s) =>
                        s
                          ? {
                              ...s,
                              cpmCoinOffer: {
                                ...s.cpmCoinOffer,
                                description: e.target.value,
                              },
                            }
                          : null
                    )
                  }
                />
              </div>
              <div className="space-y-2 self-end">
                <div className="flex items-center gap-2 rounded-lg p-3">
                  <Switch
                    id="cpm-offer-vip-code"
                    checked={settings.cpmCoinOffer.includeVipCode}
                    onCheckedChange={(checked) =>
                      setSettings(
                        (s) =>
                          s
                            ? {
                                ...s,
                                cpmCoinOffer: {
                                  ...s.cpmCoinOffer,
                                  includeVipCode: checked,
                                },
                              }
                            : null
                      )
                    }
                  />
                  <Label
                    htmlFor="cpm-offer-vip-code"
                    className="flex items-center gap-2 font-normal text-base"
                  >
                    <KeyRound /> Include Free VIP Code
                  </Label>
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="offer-start">Start Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !settings.cpmCoinOffer.startTime &&
                              "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {settings.cpmCoinOffer.startTime ? (
                            format(
                              new Date(settings.cpmCoinOffer.startTime),
                              "PPP"
                            )
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            settings.cpmCoinOffer.startTime
                              ? new Date(settings.cpmCoinOffer.startTime)
                              : undefined
                          }
                          onSelect={(date) =>
                            handleOfferDateTimeChange(
                              "startTime",
                              date?.toISOString() || "",
                              "date"
                            )
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={format(
                        new Date(settings.cpmCoinOffer.startTime),
                        "HH:mm"
                      )}
                      onChange={(e) =>
                        handleOfferDateTimeChange(
                          "startTime",
                          e.target.value,
                          "time"
                        )
                      }
                      className="w-[120px]"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="offer-end">End Date & Time</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !settings.cpmCoinOffer.endTime &&
                              "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {settings.cpmCoinOffer.endTime ? (
                            format(
                              new Date(settings.cpmCoinOffer.endTime),
                              "PPP"
                            )
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={
                            settings.cpmCoinOffer.endTime
                              ? new Date(settings.cpmCoinOffer.endTime)
                              : undefined
                          }
                          onSelect={(date) =>
                            handleOfferDateTimeChange(
                              "endTime",
                              date?.toISOString() || "",
                              "date"
                            )
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={format(
                        new Date(settings.cpmCoinOffer.endTime),
                        "HH:mm"
                      )}
                      onChange={(e) =>
                        handleOfferDateTimeChange(
                          "endTime",
                          e.target.value,
                          "time"
                        )
                      }
                      className="w-[120px]"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
