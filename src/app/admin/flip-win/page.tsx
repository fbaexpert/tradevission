
"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { FlipVertical, LoaderCircle, Trash2, PlusCircle, Percent, Coins, DollarSign } from "lucide-react";
import { nanoid } from "nanoid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


type RewardType = "CASH" | "CPM_COIN" | "NO_REWARD";

interface FlipReward {
    id: string;
    label: string;
    value: number;
    type: RewardType;
    probability: number;
}

interface FlipWinSettings {
    cost: {
        usd: number;
        cpm: number;
    },
    rewards: FlipReward[];
}

const defaultSettings: FlipWinSettings = {
    cost: {
        usd: 2,
        cpm: 20
    },
    rewards: [
        { id: nanoid(), label: "+$5", value: 5, type: "CASH", probability: 20 },
        { id: nanoid(), label: "Try Again", value: 0, type: "NO_REWARD", probability: 50 },
        { id: nanoid(), label: "+10 CPM", value: 10, type: "CPM_COIN", probability: 30 },
    ]
};

export default function AdminFlipWinPage() {
    const { db } = useFirebase();
    const [settings, setSettings] = useState<FlipWinSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!db) return;
        const settingsDocRef = doc(db, "system", "flipWinSettings");

        const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as FlipWinSettings;
                setSettings(data);
            } else {
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);
    
    const handleSave = () => {
        if (!settings || !db) return;

        if (settings.rewards.length < 1) {
            toast({ variant: "destructive", title: "Validation Error", description: "You must have at least 1 reward." });
            return;
        }
        if (totalProbability === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Total probability cannot be zero. Please set chances for your rewards." });
            return;
        }

        setSaving(true);
        const settingsDocRef = doc(db, "system", "flipWinSettings");
        
        setDoc(settingsDocRef, settings, { merge: true }).then(() => {
            toast({
                title: "Settings Saved",
                description: "Flip & Win settings have been updated.",
            });
        }).catch((error) => {
            toast({ variant: "destructive", title: "Save Failed" });
        }).finally(() => {
            setSaving(false);
        });
    };

    const handleRewardChange = (id: string, field: keyof FlipReward, value: string | number | RewardType) => {
        if (!settings) return;
        const newRewards = settings.rewards.map(reward => {
            if (reward.id === id) {
                const updatedReward = { ...reward, [field]: value };
                if(field === 'type' && value === 'NO_REWARD') {
                    updatedReward.value = 0;
                    updatedReward.label = "Try Again";
                }
                return updatedReward;
            }
            return reward;
        });
        setSettings({ ...settings, rewards: newRewards });
    };

    const handleCostChange = (type: 'usd' | 'cpm', value: string) => {
        if(!settings) return;
        const numValue = Number(value);
        if(!isNaN(numValue) && numValue >= 0) {
            setSettings({
                ...settings,
                cost: {
                    ...settings.cost,
                    [type]: numValue
                }
            })
        }
    }

    const addReward = () => {
        if (!settings) return;
        const newReward: FlipReward = { id: nanoid(), label: "New Reward", value: 0, type: "NO_REWARD", probability: 10 };
        setSettings({ ...settings, rewards: [...settings.rewards, newReward] });
    };

    const removeReward = (id: string) => {
        if (!settings) return;
        const newRewards = settings.rewards.filter(reward => reward.id !== id);
        setSettings({ ...settings, rewards: newRewards });
    };
    
    const totalProbability = useMemo(() => {
        if (!settings) return 0;
        return settings.rewards.reduce((acc, reward) => acc + (reward.probability || 0), 0);
    }, [settings]);


    if(loading || !settings) {
        return <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto mt-10"/></div>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white font-bold"><FlipVertical/>Flip & Win Settings</CardTitle>
                <CardDescription>Configure the cost, rewards, and probabilities for the card flip game.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                <div className="space-y-4 rounded-lg border p-4">
                    <Label className="text-lg font-bold text-white">Game Cost</Label>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cost-usd" className="flex items-center gap-2"><DollarSign/> Cost in balance</Label>
                            <Input
                                id="cost-usd"
                                type="number"
                                step="0.01"
                                value={settings.cost.usd}
                                onChange={(e) => handleCostChange('usd', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="cost-cpm" className="flex items-center gap-2"><Coins/> Cost in CPM Coins</Label>
                            <Input
                                id="cost-cpm"
                                type="number"
                                value={settings.cost.cpm}
                                onChange={(e) => handleCostChange('cpm', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="text-lg font-bold text-white">Possible Rewards</Label>
                        {totalProbability > 0 && (
                             <div className="text-sm font-bold text-muted-foreground">Total Chance: {totalProbability}</div>
                        )}
                    </div>
                    {settings.rewards.map((reward) => {
                       const percentage = totalProbability > 0 ? ((reward.probability || 0) / totalProbability) * 100 : 0;
                       return (
                        <div key={reward.id} className="flex flex-col sm:flex-row items-end gap-4 p-4 rounded-lg border bg-muted/30">
                           <div className="w-full sm:w-1/4 space-y-2">
                                <Label htmlFor={`type-${reward.id}`}>Type</Label>
                                <Select 
                                    value={reward.type} 
                                    onValueChange={(v) => handleRewardChange(reward.id, 'type', v as RewardType)}
                                >
                                    <SelectTrigger id={`type-${reward.id}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Points Bonus</SelectItem>
                                        <SelectItem value="CPM_COIN">CPM Coin</SelectItem>
                                        <SelectItem value="NO_REWARD">No Reward</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                            <div className="flex-1 space-y-2 w-full">
                                <Label htmlFor={`label-${reward.id}`}>Label</Label>
                                <Input
                                    id={`label-${reward.id}`}
                                    value={reward.label}
                                    onChange={(e) => handleRewardChange(reward.id, 'label', e.target.value)}
                                    placeholder="e.g., +1.00 Bonus"
                                    disabled={reward.type === 'NO_REWARD'}
                                />
                            </div>
                           {reward.type !== 'NO_REWARD' && (
                            <div className="w-full sm:w-1/5 space-y-2">
                                <Label htmlFor={`value-${reward.id}`}>{reward.type === 'CASH' ? 'Value (Points)' : 'Value (CPM)'}</Label>
                                <Input
                                    id={`value-${reward.id}`}
                                    type="number"
                                    step="0.01"
                                    value={reward.value}
                                    onChange={(e) => handleRewardChange(reward.id, 'value', parseFloat(e.target.value) || 0)}
                                />
                            </div>
                           )}
                           <div className="w-full sm:w-1/5 space-y-2">
                                <Label htmlFor={`prob-${reward.id}`}>Chance</Label>
                                <Input
                                    id={`prob-${reward.id}`}
                                    type="number"
                                    value={reward.probability}
                                    onChange={(e) => handleRewardChange(reward.id, 'probability', parseInt(e.target.value, 10) || 0)}
                                    placeholder="e.g., 10"
                                />
                           </div>
                            <div className="w-full sm:w-[100px] text-center">
                                <div className="text-2xl font-bold text-primary">{percentage.toFixed(1)}%</div>
                                <div className="text-xs text-muted-foreground">Probability</div>
                            </div>
                           <Button variant="destructive" size="icon" onClick={() => removeReward(reward.id)}>
                               <Trash2 className="h-4 w-4"/>
                           </Button>
                        </div>
                       )
                    })}

                    <Button variant="outline" onClick={addReward}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Reward
                    </Button>
                </div>
                 {totalProbability > 0 && Math.round(totalProbability) !== 100 && (
                    <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                        <Percent className="h-4 w-4 !text-yellow-300"/>
                        <AlertTitle>Probability Warning</AlertTitle>
                        <AlertDescription>
                            The sum of your reward chances is {totalProbability}. While not required, it is recommended to have the sum of chances equal 100 for clear percentage representation.
                        </AlertDescription>
                    </Alert>
                )}
                
                <div className="border-t pt-6">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Changes
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
