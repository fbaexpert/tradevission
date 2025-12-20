
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
  Timestamp,
  query,
  orderBy,
  getDocs,
  writeBatch,
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
import { LoaderCircle, Scale, PlusCircle, Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { defaultLegalPages } from "@/lib/default-legal-content";

const legalPageSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters."),
  slug: z.string().min(3, "Slug is required.").regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens."),
  content: z.string().min(20, "Content must be at least 20 characters."),
  lastUpdated: z.date(),
  category: z.enum(['legal', 'policy']).default('policy'),
  inFooter: z.boolean().default(true),
  order: z.coerce.number().default(0),
});

type LegalPageFormData = z.infer<typeof legalPageSchema>;

interface LegalPage extends LegalPageFormData {
  id: string;
}

export default function AdminLegalPage() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPage, setEditingPage] = useState<LegalPage | null>(null);

  const form = useForm<LegalPageFormData>({
    resolver: zodResolver(legalPageSchema),
    defaultValues: {
      title: "",
      slug: "",
      content: "",
      lastUpdated: new Date(),
      category: 'policy',
      inFooter: true,
      order: 0,
    },
  });

  useEffect(() => {
    if (!db) return;
    setLoading(true);

    const seedDatabase = async () => {
        const legalCollectionRef = collection(db, "legal");
        const snapshot = await getDocs(legalCollectionRef);
        if (snapshot.empty) {
            toast({ title: "Seeding Database", description: "Adding default legal pages..."});
            const batch = writeBatch(db);
            defaultLegalPages.forEach(page => {
                const docRef = doc(legalCollectionRef);
                batch.set(docRef, { ...page, lastUpdated: Timestamp.fromDate(new Date(page.lastUpdated)) });
            });
            await batch.commit();
            toast({ title: "Seeding Complete", description: "Default legal pages have been added."});
        }
    }

    const setupListener = () => {
        const q = query(collection(db, "legal"), orderBy("order", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const pagesData = snapshot.docs.map(
            (doc) => ({
              id: doc.id,
              ...(doc.data() as Omit<LegalPage, "id" | "lastUpdated">),
              lastUpdated: (doc.data().lastUpdated as Timestamp).toDate(),
            })
          );
          setPages(pagesData);
          setLoading(false);
        }, (error) => {
            console.error("Error fetching legal pages:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not fetch legal pages."});
            setLoading(false);
        });
        return unsubscribe;
    };
    
    seedDatabase().then(() => {
        setupListener();
    }).catch(error => {
        console.error("Error during seeding:", error);
        toast({ variant: "destructive", title: "Initialization Failed", description: "Could not set up legal pages."});
        // Still try to set up listener in case seeding failed but data exists
        setupListener();
    });

  }, [db, toast]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    form.setValue("title", title);
    if (!form.formState.dirtyFields.slug) {
        const slug = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        form.setValue("slug", slug);
    }
  }

  const onSubmit = async (data: LegalPageFormData) => {
    if (!db) return;
    setIsSubmitting(true);
    
    const payload = {
        ...data,
        lastUpdated: Timestamp.fromDate(data.lastUpdated),
    };

    try {
      if (editingPage) {
        await updateDoc(doc(db, "legal", editingPage.id), payload);
        toast({ title: "Page Updated" });
      } else {
        await addDoc(collection(db, "legal"), payload);
        toast({ title: "Page Created" });
      }
      handleCancelEdit();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (page: LegalPage) => {
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
      lastUpdated: new Date(),
      category: 'policy',
      inFooter: true,
      order: 0,
    });
  };

  const handleDelete = async (pageId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "legal", pageId));
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
            {editingPage ? "Edit Legal Page" : "Create New Legal Page"}
          </CardTitle>
          <CardDescription>
            Manage the legal and policy pages that appear in your website's footer.
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
              <Label htmlFor="content">Content (Supports simple HTML tags)</Label>
              <Textarea id="content" {...form.register("content")} rows={10} />
              {form.formState.errors.content && <p className="text-red-500 text-sm">{form.formState.errors.content.message}</p>}
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Controller
                        name="category"
                        control={form.control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="legal">Legal</SelectItem>
                                    <SelectItem value="policy">Policy</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="order">Footer Order</Label>
                    <Input id="order" type="number" {...form.register("order")} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="lastUpdated">Last Updated</Label>
                    <Input id="lastUpdated" type="date" value={format(form.watch("lastUpdated"), "yyyy-MM-dd")} onChange={(e) => form.setValue('lastUpdated', new Date(e.target.value))} />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                     <Controller
                        name="inFooter"
                        control={form.control}
                        render={({ field }) => (
                            <Switch id="inFooter" checked={field.value} onCheckedChange={field.onChange} />
                        )}
                    />
                    <Label htmlFor="inFooter">Show in Footer</Label>
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
            <CardTitle className="flex items-center gap-2 text-white font-bold"><Scale/> Existing Pages</CardTitle>
            <CardDescription>A list of all created legal and policy pages.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? <div className="flex justify-center p-8"><LoaderCircle className="animate-spin"/></div> : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order</TableHead>
                                <TableHead>Title</TableHead>
                                <TableHead>Category</TableHead>
                                <TableHead>Slug</TableHead>
                                <TableHead>In Footer?</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pages.map(page => (
                                <TableRow key={page.id}>
                                    <TableCell>{page.order}</TableCell>
                                    <TableCell>{page.title}</TableCell>
                                    <TableCell className="capitalize">{page.category}</TableCell>
                                    <TableCell>/legal/{page.slug}</TableCell>
                                    <TableCell>{page.inFooter ? "Yes" : "No"}</TableCell>
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
