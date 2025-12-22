'use server';

import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { revalidatePath } from 'next/cache';
import { getFirebase } from '@/lib/firebase/config';

interface PageFormData {
    title: string;
    slug: string;
    content: string;
    category: string;
    order: number;
    isActive: boolean;
    inFooter: boolean;
}

export async function createPageAction(data: PageFormData) {
    const { db } = getFirebase();
    await addDoc(collection(db, "websitePages"), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    revalidatePath('/');
    revalidatePath(`/${data.slug}`);
}


export async function updatePageAction(id: string, data: PageFormData) {
    const { db } = getFirebase();
    const pageDocRef = doc(db, "websitePages", id);
    await updateDoc(pageDocRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
    revalidatePath('/');
    revalidatePath(`/${data.slug}`);
}
