
"use client";

import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Star, LoaderCircle, Trash2, PlusCircle, Percent } from "lucide-react";
import { nanoid } from "nanoid";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";


type RewardType = "CASH" | "TRY_AGAIN";

interface SpinReward {
    id: string;
    label: string;
    value: number;
    type: RewardType;
    probability: number;
}

interface SpinWinSettings {
    rewards: SpinReward[];
}

const defaultSettings: SpinWinSettings = {
    rewards: [
        { id: nanoid(), label: "+$0.20", value: 0.20, type: "CASH", probability: 30 },
        { id: nanoid(), label: "Try Again", value: 0, type: "TRY_AGAIN", probability: 5 },
        { id: nanoid(), label: "+$0.50", value: 0.50, type: "CASH", probability: 25 },
        { id: nanoid(), label: "Try Again", value: 0, type: "TRY_AGAIN", probability: 5 },
        { id: nanoid(), label: "+$1.00", value: 1.00, type: "CASH", probability: 15 },
        { id: nanoid(), label: "Try Again", value: 0, type: "TRY_AGAIN", probability: 5 },
    ]
};

export default function AdminSpinWinPage() {
    const { db } = useFirebase();
    const [settings, setSettings] = useState<SpinWinSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!db) return;
        const settingsDocRef = doc(db, "system", "spinWinSettings");

        const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data() as SpinWinSettings;
                // Ensure every reward has a probability
                const rewardsWithProbs = data.rewards.map(r => ({ ...r, probability: r.probability ?? 10 }));
                setSettings({ ...data, rewards: rewardsWithProbs });
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

        if (settings.rewards.length < 2) {
            toast({ variant: "destructive", title: "Validation Error", description: "You must have at least 2 reward segments." });
            return;
        }
        if (totalProbability === 0) {
            toast({ variant: "destructive", title: "Validation Error", description: "Total probability cannot be zero. Please set chances for your rewards." });
            return;
        }

        setSaving(true);
        const settingsDocRef = doc(db, "system", "spinWinSettings");
        
        setDoc(settingsDocRef, settings, { merge: true }).then(() => {
            toast({
                title: "Settings Saved",
                description: "Spin & Win settings have been updated.",
            });
        }).catch((error) => {
            toast({ variant: "destructive", title: "Save Failed" });
        }).finally(() => {
            setSaving(false);
        });
    };

    const handleRewardChange = (id: string, field: keyof SpinReward, value: string | number | RewardType) => {
        if (!settings) return;
        const newRewards = settings.rewards.map(reward => {
            if (reward.id === id) {
                const updatedReward = { ...reward, [field]: value };
                if(field === 'type' && value === 'TRY_AGAIN') {
                    updatedReward.value = 0;
                    updatedReward.label = "Try Again";
                }
                return updatedReward;
            }
            return reward;
        });
        setSettings({ ...settings, rewards: newRewards });
    };

    const addReward = () => {
        if (!settings) return;
        const newReward: SpinReward = { id: nanoid(), label: "New Reward", value: 0, type: "TRY_AGAIN", probability: 10 };
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
                <CardTitle className="flex items-center gap-2 text-white font-bold"><Star/>Spin & Win Settings</CardTitle>
                <CardDescription>Configure the rewards and their appearance probability for the daily spin wheel.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="text-lg font-bold text-white">Reward Segments</Label>
                        {totalProbability > 0 && (
                             <div className="text-sm font-bold text-muted-foreground">Total Chance: {totalProbability}</div>
                        )}
                    </div>
                    {settings.rewards.map((reward) => {
                       const percentage = totalProbability > 0 ? ((reward.probability || 0) / totalProbability) * 100 : 0;
                       return (
                        <div key={reward.id} className="flex items-end gap-4 p-4 rounded-lg border bg-muted/30">
                           <div className="w-1/4 space-y-2">
                                <Label htmlFor={`type-${reward.id}`}>Type</Label>
                                <Select 
                                    value={reward.type} 
                                    onValueChange={(v) => handleRewardChange(reward.id, 'type', v as RewardType)}
                                >
                                    <SelectTrigger id={`type-${reward.id}`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Cash Bonus</SelectItem>
                                        <SelectItem value="TRY_AGAIN">Try Again</SelectItem>
                                    </SelectContent>
                                </Select>
                           </div>
                           {reward.type === 'CASH' && (
                               <>
                                <div className="flex-1 space-y-2">
                                    <Label htmlFor={`label-${reward.id}`}>Label</Label>
                                    <Input
                                        id={`label-${reward.id}`}
                                        value={reward.label}
                                        onChange={(e) => handleRewardChange(reward.id, 'label', e.target.value)}
                                        placeholder="e.g., +$1.00 Bonus"
                                    />
                                </div>
                                <div className="w-1/5 space-y-2">
                                    <Label htmlFor={`value-${reward.id}`}>Value ($)</Label>
                                    <Input
                                        id={`value-${reward.id}`}
                                        type="number"
                                        step="0.01"
                                        value={reward.value}
                                        onChange={(e) => handleRewardChange(reward.id, 'value', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                               </>
                           )}
                           <div className="w-1/5 space-y-2">
                                <Label htmlFor={`prob-${reward.id}`}>Chance</Label>
                                <Input
                                    id={`prob-${reward.id}`}
                                    type="number"
                                    value={reward.probability}
                                    onChange={(e) => handleRewardChange(reward.id, 'probability', parseInt(e.target.value, 10) || 0)}
                                    placeholder="e.g., 10"
                                />
                           </div>
                            <div className="w-[100px] text-center">
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
                        Add Segment
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
