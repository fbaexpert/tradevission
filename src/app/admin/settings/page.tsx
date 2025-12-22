
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Settings, LoaderCircle } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
import { Textarea } from "@/components/ui/textarea";

interface FooterSettings {
    contact: string;
    copyright: string;
}

const defaultSettings: FooterSettings = {
    contact: "support@tradevission.online",
    copyright: "© 2024 TradeVission. All Rights Reserved."
};

export default function AdminSettingsPage() {
    const { db } = useFirebase();
    const [settings, setSettings] = useState<FooterSettings>(defaultSettings);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        if (!db) return;

        const settingsDocRef = doc(db, "site_footer", "content");
        const unsubscribe = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as FooterSettings);
            } else {
                // If doc doesn't exist, create it with default values
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [db]);

    const handleSave = () => {
        if (!settings || !db) return;
        setSaving(true);

        const settingsDocRef = doc(db, "site_footer", "content");
        
        setDoc(settingsDocRef, settings, { merge: true }).then(() => {
            toast({
                title: "Settings Saved",
                description: "Footer settings have been updated successfully.",
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
    
    if(loading) {
        return <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin mx-auto mt-10"/></div>
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white font-bold"><Settings/>Site Settings</CardTitle>
                <CardDescription>Manage site-wide settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="space-y-4 rounded-lg border p-4">
                    <Label className="text-base flex items-center gap-2">Footer Settings</Label>
                    <p className="text-sm text-muted-foreground">Edit the content displayed in the website footer.</p>
                    <div className="space-y-4 pt-4 border-t">
                        <div className="space-y-2">
                            <Label htmlFor="footer-email">Contact Email</Label>
                            <Input id="footer-email" type="email" value={settings.contact} onChange={(e) => setSettings(s => ({...s, contact: e.target.value}))} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="footer-copyright">Copyright Text</Label>
                            <Textarea id="footer-copyright" value={settings.copyright} onChange={(e) => setSettings(s => ({...s, copyright: e.target.value}))} />
                        </div>
                    </div>
                </div>
                
                <div className="mt-8 border-t pt-6">
                    <Button onClick={handleSave} disabled={saving} size="lg">
                        {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Save All Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
