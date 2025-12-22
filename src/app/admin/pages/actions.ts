'use server';

import { getFirebase } from "@/lib/firebase/config";
import { doc, setDoc, Timestamp, addDoc, collection, deleteDoc } from "firebase/firestore";
import { revalidatePath } from "next/cache";

interface PageData {
    slug: string;
    title: string;
    content: string;
    category: string;
    order: number;
    isActive: boolean;
    inFooter: boolean;
}

export async function createPageAction(data: PageData) {
    const { db } = getFirebase();
    
    const pageRef = doc(db, "websitePages", data.slug);
    
    await setDoc(pageRef, {
        ...data,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
    });

    revalidatePath('/'); // Revalidate home to update footer
    revalidatePath(`/${data.slug}`); // Revalidate the specific page
}


export async function updatePageAction(slug: string, data: Partial<PageData>) {
    const { db } = getFirebase();
    const pageRef = doc(db, "websitePages", slug);
    
    await setDoc(pageRef, { 
        ...data,
        updatedAt: Timestamp.now()
    }, { merge: true });

    revalidatePath('/'); // Revalidate home page to update footer
    revalidatePath(`/${slug}`); // Revalidate the specific page
}

export async function deletePageAction(slug: string) {
    const { db } = getFirebase();
    const pageRef = doc(db, "websitePages", slug);

    await deleteDoc(pageRef);

    revalidatePath('/'); // Revalidate home page to update footer
    revalidatePath(`/${slug}`); // Revalidate the specific page path
}
