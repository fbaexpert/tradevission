'use client';

import { useState, useEffect, useTransition } from "react";
import { useRouter, useParams } from "next/navigation";
import { getFirebase } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Save, ArrowLeft, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { updatePageAction } from "../../actions";

const pageSchema = z.object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    content: z.string().min(10, "Content is required."),
});

type PageFormData = z.infer<typeof pageSchema>;

interface PageContent {
    title: string;
    content: string;
}

export default function EditPage() {
    const router = useRouter();
    const params = useParams();
    const pageId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { db } = getFirebase();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const form = useForm<PageFormData>({
        resolver: zodResolver(pageSchema),
        defaultValues: {
            title: "",
            content: "",
        },
    });

    useEffect(() => {
        if (!db || !pageId) return;
        
        const fetchPage = async () => {
            setLoading(true);
            const pageRef = doc(db, "websitePages", pageId);
            const docSnap = await getDoc(pageRef);

            if (docSnap.exists()) {
                const data = docSnap.data() as PageContent;
                form.reset(data);
            } else {
                toast({
                    variant: "destructive",
                    title: "Page Not Found",
                    description: "The page you are trying to edit does not exist.",
                });
                router.push('/admin/settings');
            }
            setLoading(false);
        };

        fetchPage();
    }, [db, pageId, form, router, toast]);

    const onSubmit = (data: PageFormData) => {
        startTransition(async () => {
            try {
                if (!pageId) {
                    throw new Error("Page ID is missing.");
                }
                await updatePageAction(pageId, data);
                toast({
                    title: "Page Updated",
                    description: `The "${data.title}" page has been successfully saved.`,
                });
                router.push('/admin/settings');
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Save Failed",
                    description: "An error occurred while saving the page.",
                });
            }
        });
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><LoaderCircle className="animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FileText />
                            Edit Page: {form.getValues('title') || pageId}
                        </CardTitle>
                        <CardDescription>Update the title and content for this page.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Page Title</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., About Us" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="content"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Content</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Write the content for your page here..." {...field} rows={15} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <Button type="submit" disabled={isPending}>
                            {isPending && <LoaderCircle className="animate-spin mr-2"/>}
                            <Save /> Save Changes
                        </Button>
                    </CardContent>
                </form>
            </Form>
        </Card>
    );
}
