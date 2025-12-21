
"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  Timestamp,
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
import { LoaderCircle, FileText, PlusCircle, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const pageCategories = ['Legal', 'Privacy', 'Terms', 'Help', 'Policies'] as const;

const pageSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  category: z.enum(pageCategories),
  content: z.string().min(10, "Content is required."),
});

type PageFormData = z.infer<typeof pageSchema>;

interface WebsitePage {
  id: string;
  title: string;
  category: string;
  createdAt: Timestamp;
}

export default function AdminPages() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<PageFormData>({
    resolver: zodResolver(pageSchema),
    defaultValues: {
      title: "",
      category: 'Legal',
      content: "",
    },
  });

  useEffect(() => {
    if (!db) return;

    const q = query(collection(db, "pages"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const pagesData = snapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as WebsitePage)
      );
      setPages(pagesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const onSubmit = async (data: PageFormData) => {
    if (!db) return;
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, "pages"), {
        ...data,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Page Created", description: `"${data.title}" has been successfully added.` });
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

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
            <PlusCircle /> Create New Page
          </CardTitle>
          <CardDescription>
            Add new pages that will appear in your website's footer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
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
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {pageCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea id="content" {...form.register("content")} rows={8} />
              {form.formState.errors.content && <p className="text-red-500 text-sm">{form.formState.errors.content.message}</p>}
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <LoaderCircle className="animate-spin mr-2" /> : <PlusCircle className="mr-2"/>}
              Create Page
            </Button>
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
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{page.category}</Badge>
                      </TableCell>
                      <TableCell>{page.createdAt ? new Date(page.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</TableCell>
                      <TableCell className="text-right">
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
