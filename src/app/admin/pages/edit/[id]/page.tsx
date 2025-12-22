"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoaderCircle, Save, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updatePageAction } from "../../actions";

const pageSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    slug: z.string().min(3, "Slug must be at least 3 characters.").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
    content: z.string().min(10, "Content is required."),
    category: z.string().min(1, "Category is required."),
    order: z.coerce.number().int(),
    isActive: z.boolean(),
    inFooter: z.boolean(),
});

type PageFormData = z.infer<typeof pageSchema>;

interface PageCategory {
  id: string;
  name: string;
}

export default function EditPage() {
    const { id } = useParams();
    const router = useRouter();
    const { db } = useFirebase();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pageCategories, setPageCategories] = useState<PageCategory[]>([]);

    const form = useForm<PageFormData>({
        resolver: zodResolver(pageSchema),
        defaultValues: {
            title: "",
            slug: "",
            content: "",
            category: "",
            order: 0,
            isActive: false,
            inFooter: false,
        },
    });

    useEffect(() => {
        if (!db || !id) return;
        
        const settingsDocRef = doc(db, "system", "settings");
        const unsubscribeCategories = onSnapshot(settingsDocRef, (doc) => {
            if(doc.exists()) setPageCategories(doc.data().pageCategories || []);
        });

        const pageDocRef = doc(db, "websitePages", id as string);
        getDoc(pageDocRef).then((docSnap) => {
            if (docSnap.exists()) {
                form.reset(docSnap.data() as PageFormData);
            } else {
                toast({ variant: "destructive", title: "Not Found", description: "The requested page does not exist." });
                router.push("/admin/settings");
            }
            setLoading(false);
        });

        return () => unsubscribeCategories();
    }, [db, id, form, router, toast]);
    
     const generateSlug = () => {
        const title = form.getValues("title");
        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        form.setValue("slug", slug, { shouldValidate: true });
    };

    const onSubmit = async (data: PageFormData) => {
        if (!id) return;
        setIsSubmitting(true);
        try {
            await updatePageAction(id as string, data);
            toast({ title: "Page Updated", description: `"${data.title}" has been saved.` });
            router.push("/admin/settings");
        } catch (error: any) {
            toast({ variant: "destructive", title: "Update Failed", description: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-full"><LoaderCircle className="animate-spin text-primary h-12 w-12" /></div>
    }

    return (
        <div className="max-w-4xl mx-auto">
            <Button variant="outline" onClick={() => router.push('/admin/settings')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Settings
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Edit Page</CardTitle>
                    <CardDescription>Make changes to your page content and settings below.</CardDescription>
                </CardHeader>
                 <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Page Title</Label>
                                <Input id="title" {...form.register("title")} />
                                {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="slug">Page Slug (URL)</Label>
                                <div className="flex gap-2">
                                    <Input id="slug" {...form.register("slug")} />
                                    <Button type="button" variant="outline" onClick={generateSlug}>Generate</Button>
                                </div>
                                {form.formState.errors.slug && <p className="text-red-500 text-sm">{form.formState.errors.slug.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                             <Label htmlFor="content">Content</Label>
                             <Textarea id="content" {...form.register("content")} rows={15} />
                             {form.formState.errors.content && <p className="text-red-500 text-sm">{form.formState.errors.content.message}</p>}
                        </div>

                         <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
                            <div className="space-y-2">
                                <Label htmlFor="category">Category</Label>
                                 <Select value={form.watch('category')} onValueChange={(value) => form.setValue('category', value)}>
                                    <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                                    <SelectContent>
                                        {pageCategories.map(cat => <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                {form.formState.errors.category && <p className="text-red-500 text-sm">{form.formState.errors.category.message}</p>}
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="order">Order</Label>
                                <Input id="order" type="number" {...form.register("order")} />
                                {form.formState.errors.order && <p className="text-red-500 text-sm">{form.formState.errors.order.message}</p>}
                            </div>
                             <div className="flex items-center gap-2 p-3 border rounded-md">
                                <Switch id="isActive" checked={form.watch('isActive')} onCheckedChange={(c) => form.setValue('isActive', c)} />
                                <Label htmlFor="isActive">Publish Page</Label>
                            </div>
                             <div className="flex items-center gap-2 p-3 border rounded-md">
                                <Switch id="inFooter" checked={form.watch('inFooter')} onCheckedChange={(c) => form.setValue('inFooter', c)} />
                                <Label htmlFor="inFooter">Show in Footer</Label>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                             <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <LoaderCircle className="animate-spin mr-2"/>}
                                <Save className="mr-2" /> Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </form>
            </Card>
        </div>
    );
}
