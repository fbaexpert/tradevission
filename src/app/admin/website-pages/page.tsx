
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp
} from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoaderCircle, FileText, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const pageCategories = ['Legal', 'Privacy', 'Terms', 'Policies', 'Help'] as const;

const pageSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  slug: z.string().min(3, "Slug is required.").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
  content: z.string().min(20, "Content must be at least 20 characters."),
  category: z.enum(pageCategories),
  order: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

type PageFormData = z.infer<typeof pageSchema>;

interface WebsitePage extends PageFormData {
  id: string;
  createdAt: Timestamp;
}

export default function AdminWebsitePages() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPage, setEditingPage] = useState<WebsitePage | null>(null);

  const form = useForm<PageFormData>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      category: 'Policies',
      order: 0,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const q = query(collection(db, "websitePages"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const pagesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as WebsitePage)
        );
        setPages(pagesData);
        setLoading(false);
    }, (error) => {
        console.error("Error fetching website pages:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not fetch pages."});
        setLoading(false);
    });

    return () => unsubscribe();
  }, [db, toast]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValue("title", title);
    if (!form.formState.dirtyFields.slug) {
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        form.setValue("slug", slug);
    }
  }

  const onSubmit = async (data: PageFormData) => {
    if (!db) return;
    setIsSubmitting(true);

    try {
      if (editingPage) {
        await updateDoc(doc(db, "websitePages", editingPage.id), { ...data, updatedAt: serverTimestamp() });
        toast({ title: "Page Updated" });
      } else {
        const docRef = await addDoc(collection(db, "websitePages"), { ...data, createdAt: serverTimestamp() });
        console.log('Page created:', {category: data.category, title: data.title, id: docRef.id});
        console.log('Firestore write result:', docRef.id);
        toast({ title: "Page Created" });
      }
      handleCancelEdit();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (page: WebsitePage) => {
    setEditingPage(page);
    form.reset(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingPage(null);
    form.reset({
      title: "",
      slug: "",
      content: "",
      category: 'Policies',
      order: 0,
      isActive: true,
    });
  };

  const handleDelete = async (pageId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "websitePages", pageId));
      toast({ title: "Page Deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Deletion Failed" });
    }
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white font-bold">
            {editingPage ? <Edit /> : <PlusCircle />}
            {editingPage ? "Edit Website Page" : "Create New Website Page"}
          </CardTitle>
          <CardDescription>
            Manage the content pages that appear in your website's footer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input id="title" {...form.register("title")} onChange={handleTitleChange} />
                {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Page Slug (URL)</Label>
                <Input id="slug" {...form.register("slug")} placeholder="e.g., privacy-policy" />
                {form.formState.errors.slug && <p className="text-red-500 text-sm">{form.formState.errors.slug.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" {...form.register("content")} rows={10} />
              {form.formState.errors.content && <p className="text-red-500 text-sm">{form.formState.errors.content.message}</p>}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Controller
                        name="category"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    {pageCategories.map(cat => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="order">Display Order</Label>
                    <Input id="order" type="number" {...form.register("order")} />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                     <Controller
                        name="isActive"
                        control={form.control}
                        render={({ field }) => (
                            <Switch id="isActive" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                    <Label htmlFor="isActive">Show in Footer</Label>
                </div>
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="animate-spin mr-2" />}
                {editingPage ? "Update Page" : "Create Page"}
              </Button>
              {editingPage && (
                <Button type="button" variant="outline" onClick={handleCancelEdit}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white font-bold"><FileText/> Existing Pages</CardTitle>
            <CardDescription>A list of all created content pages.</CardDescription>
        </CardHeader>
        <CardContent>
             {loading ? (
                <div className="flex justify-center p-8"><LoaderCircle className="animate-spin"/></div>
             ) : pages.length === 0 ? (
                <p className="text-center text-muted-foreground p-8">No pages have been created yet.</p>
             ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Title</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Order</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pages.map(page => (
                                <TableRow key={page.id}>
                                    <TableCell className="font-medium">{page.title}</TableCell>
                                    <TableCell><Badge variant="outline">{page.category}</Badge></TableCell>
                                    <TableCell>{page.order}</TableCell>
                                    <TableCell>
                                        <Badge variant={page.isActive ? "default" : "destructive"}>
                                            {page.isActive ? "Active" : "Hidden"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEdit(page)}><Edit className="h-4 w-4"/></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the "{page.title}" page.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(page.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
             )}
        </CardContent>
      </Card>
    </div>
  );
}
