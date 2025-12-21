
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
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { useFirebase } from "@/lib/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoaderCircle, FileText, PlusCircle, Trash2, Edit } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from 'date-fns';

const pageSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  category: z.string().min(1, "Category is required."),
  content: z.string().min(10, "Content is required."),
  order: z.coerce.number().default(0),
});

type PageFormData = z.infer<typeof pageSchema>;

interface WebsitePage {
  id: string;
  title: string;
  category: string;
  order: number;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

interface PageCategory {
    id: string;
    name: string;
}

export default function AdminPages() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [pageCategories, setPageCategories] = useState<PageCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPage, setEditingPage] = useState<WebsitePage | null>(null);

  const form = useForm<PageFormData>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      title: "",
      category: "",
      content: "",
      order: 0,
    },
  });

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, "pages"), orderBy("category"), orderBy("order"));
    const unsubscribePages = onSnapshot(q, (snapshot) => {
      const pagesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as WebsitePage)
      );
      setPages(pagesData);
      setLoading(false);
    });

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeCategories = onSnapshot(settingsDocRef, (doc) => {
        if (doc.exists()) {
            setPageCategories(doc.data().pageCategories || []);
        }
    });

    return () => {
      unsubscribePages();
      unsubscribeCategories();
    };
  }, [db]);

  const onSubmit = async (data: PageFormData) => {
    if (!db) return;
    setIsSubmitting(true);
    
    let promise;
    const dataToSave = {
        ...data,
        updatedAt: serverTimestamp(),
    };

    if (editingPage) {
        promise = updateDoc(doc(db, "pages", editingPage.id), dataToSave);
    } else {
        promise = addDoc(collection(db, "pages"), {
            ...dataToSave,
            createdAt: serverTimestamp(),
        });
    }

    try {
      await promise;
      toast({ title: `Page ${editingPage ? 'Updated' : 'Created'}`, description: `"${data.title}" has been successfully saved.` });
      handleCancelEdit();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (page: WebsitePage) => {
    setEditingPage(page);
    form.reset({
        title: page.title,
        category: page.category,
        order: page.order,
        content: "Loading content...", // Placeholder
    });
    // Fetch full content for editing
    const pageDocRef = doc(db, "pages", page.id);
    getDoc(pageDocRef).then(docSnap => {
        if (docSnap.exists()) {
            form.reset(docSnap.data() as PageFormData);
        }
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const handleCancelEdit = () => {
    setEditingPage(null);
    form.reset({ title: "", category: "", content: "", order: 0 });
  }

  const handleDelete = async (pageId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "pages", pageId));
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
            {editingPage ? "Edit Page" : "Create New Page"}
          </CardTitle>
          <CardDescription>
             {editingPage ? `You are editing "${editingPage.title}".` : "Add new pages that will appear on your website."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Page Title</Label>
                <Input id="title" {...form.register("title")} />
                {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Controller
                  name="category"
                  control={form.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger id="category"><SelectValue placeholder="Select a category"/></SelectTrigger>
                        <SelectContent>
                            {pageCategories.map(cat => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  )}
                />
                 {form.formState.errors.category && <p className="text-red-500 text-sm">{form.formState.errors.category.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="order">Display Order</Label>
                <Input id="order" type="number" {...form.register("order")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" {...form.register("content")} rows={10} />
              {form.formState.errors.content && <p className="text-red-500 text-sm">{form.formState.errors.content.message}</p>}
            </div>
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin mr-2" /> : (editingPage ? <Edit className="mr-2"/> : <PlusCircle className="mr-2"/>)}
                {editingPage ? "Update Page" : "Create Page"}
              </Button>
              {editingPage && <Button variant="outline" type="button" onClick={handleCancelEdit}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white font-bold">
            <FileText /> Existing Pages
          </CardTitle>
          <CardDescription>
            List of all created pages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><LoaderCircle className="animate-spin" /></div>
          ) : pages.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No pages created yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell>{page.category}</TableCell>
                      <TableCell>{page.order}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {page.updatedAt ? formatDistanceToNow(page.updatedAt.toDate(), { addSuffix: true }) : (page.createdAt ? formatDistanceToNow(page.createdAt.toDate(), { addSuffix: true }) : 'N/A')}
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" onClick={() => handleEdit(page)}>
                           <Edit className="h-4 w-4" />
                         </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the "{page.title}" page.
                              </AlertDialogDescription>
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
