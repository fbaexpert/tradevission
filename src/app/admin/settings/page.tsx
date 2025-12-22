
"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, collection, writeBatch, getDocs, deleteDoc, serverTimestamp, updateDoc, addDoc, query, orderBy } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, LoaderCircle, Trash2, PlusCircle, Gift, Percent, Calendar as CalendarIcon, Star, Palette, Tag, Zap, ShieldAlert, BookText } from "lucide-react";
import { useFirebase } from "@/lib/firebase/provider";
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

interface FooterSettings {
    description: string;
    contactEmail: string;
    copyrightText: string;
}

interface PageCategory {
    id: string;
    name: string;
}

interface AppSettings {
    footer: FooterSettings;
}

const defaultSettings: AppSettings = {
    footer: {
        description: "A modern platform to help you navigate the markets, invest in your future, and earn daily rewards.",
        contactEmail: "tradevissionn@gmail.com",
        copyrightText: "© 2023-2026 TradeVission. All Rights Reserved."
    }
};

export default function AdminSettingsPage() {
    const { user } = useAuth();
    const { db, auth } = useFirebase();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    
    const [pageCategories, setPageCategories] = useState<PageCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [isCategorySaving, setIsCategorySaving] = useState(false);

    useEffect(() => {
        if (!db) return;

        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                const mergedSettings: AppSettings = {
                    ...defaultSettings,
                    ...data,
                    footer: { ...defaultSettings.footer, ...(data.footer || {}) }
                };
                setSettings(mergedSettings);
            } else {
                setDoc(settingsDocRef, defaultSettings);
                setSettings(defaultSettings);
            }
            setLoading(false);
        });

        const categoriesQuery = query(collection(db, "categories"), orderBy("name", "asc"));
        const unsubscribeCategories = onSnapshot(categoriesQuery, (snapshot) => {
            const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PageCategory));
            setPageCategories(cats);
        });

        return () => {
          unsubscribeSettings();
          unsubscribeCategories();
        };
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
    
    const handleAddCategory = async () => {
        if (!newCategoryName.trim() || !db) return;
        setIsCategorySaving(true);
        try {
            await addDoc(collection(db, "categories"), {
                name: newCategoryName.trim(),
                createdAt: serverTimestamp(),
            });
            toast({ title: "Category Added" });
            setNewCategoryName("");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "Could not add category." });
        } finally {
            setIsCategorySaving(false);
        }
    }

    const handleDeleteCategory = async (categoryId: string) => {
        if (!db) return;
        try {
            await deleteDoc(doc(db, "categories", categoryId));
            toast({ title: "Category Deleted" });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not delete category." });
        }
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
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2">Footer Settings</Label>
                        <p className="text-sm text-muted-foreground">Edit the content displayed in the website footer.</p>
                        <div className="space-y-4 pt-4 border-t">
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
                     
                    <div className="space-y-4 rounded-lg border p-4">
                        <Label className="text-base flex items-center gap-2"><BookText /> Manage Page Categories</Label>
                        <p className="text-sm text-muted-foreground">Create and manage categories for website pages (e.g., Legal, Help).</p>
                        <div className="space-y-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                                <Input 
                                    placeholder="New category name..."
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    disabled={isCategorySaving}
                                />
                                <Button onClick={handleAddCategory} disabled={isCategorySaving || !newCategoryName.trim()}>
                                    {isCategorySaving ? <LoaderCircle className="animate-spin" /> : <PlusCircle />}
                                </Button>
                            </div>
                            <div className="space-y-2">
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
                    
                    <Button onClick={handleSave} disabled={saving}>
                        {saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>}
                        Save Changes
                    </Button>
                </CardContent>
            </Card>
        </>
    );
}
