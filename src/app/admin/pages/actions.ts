'use server';

import { getFirebase } from "@/lib/firebase/config";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { revalidatePath } from "next/cache";

interface PageData {
    title: string;
    content: string;
}

export async function updatePageAction(slug: string, data: PageData) {
    const { db } = getFirebase();
    const pageRef = doc(db, "websitePages", slug);
    
    await setDoc(pageRef, { 
        ...data,
        slug: slug,
        updatedAt: Timestamp.now()
    }, { merge: true });

    revalidatePath('/'); // Revalidate home page to update footer
    revalidatePath(`/${slug}`); // Revalidate the specific page
}
