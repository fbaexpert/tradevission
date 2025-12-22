'use client';

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Save, ArrowLeft, FilePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createPageAction } from "../actions";
import { Switch } from "@/components/ui/switch";

const pageSchema = z.object({
    slug: z.string().min(3, "URL slug must be at least 3 characters.").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
    title: z.string().min(3, "Title must be at least 3 characters."),
    content: z.string().min(10, "Content is required."),
    category: z.string().min(2, "Category is required."),
    order: z.coerce.number().default(0),
    isActive: z.boolean().default(true),
    inFooter: z.boolean().default(true),
});

type PageFormData = z.infer<typeof pageSchema>;

export default function NewPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const form = useForm<PageFormData>({
        resolver: zodResolver(pageSchema),
        defaultValues: {
            slug: "",
            title: "",
            content: "",
            category: "Company",
            order: 0,
            isActive: true,
            inFooter: true,
        },
    });

    const onSubmit = (data: PageFormData) => {
        startTransition(async () => {
            try {
                await createPageAction(data);
                toast({
                    title: "Page Created",
                    description: `The "${data.title}" page has been successfully created.`,
                });
                router.push('/admin/settings');
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Creation Failed",
                    description: error.message || "An error occurred while creating the page.",
                });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <FilePlus />
                            Create New Page
                        </CardTitle>
                        <CardDescription>Fill in the details for your new website page.</CardDescription>
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
                            name="slug"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>URL Slug</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., about-us" {...field} />
                                    </FormControl>
                                    <FormDescription>This will be the part of the URL. Use lowercase letters, numbers, and hyphens only.</FormDescription>
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
                         <div className="grid md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g., Company, Legal" {...field} />
                                        </FormControl>
                                        <FormDescription>Used for grouping pages in the footer.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="order"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Display Order</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormDescription>Lower numbers appear first within a category.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-wrap gap-6 pt-4">
                            <FormField
                                control={form.control}
                                name="isActive"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-3 space-y-0">
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>Publish Page</FormLabel>
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="inFooter"
                                render={({ field }) => (
                                    <FormItem className="flex items-center gap-3 space-y-0">
                                        <FormControl>
                                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        </FormControl>
                                        <FormLabel>Show link in Footer</FormLabel>
                                    </FormItem>
                                )}
                            />
                        </div>
                         <Button type="submit" disabled={isPending}>
                            {isPending && <LoaderCircle className="animate-spin mr-2"/>}
                            <Save /> Create Page
                        </Button>
                    </CardContent>
                </form>
            </Form>
        </Card>
    );
}
