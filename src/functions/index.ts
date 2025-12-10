import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

/**
 * Deletes a user and all their associated data across Firebase services.
 * - Deletes from Firebase Authentication.
 * - Deletes all user data from Firestore, including documents in subcollections.
 * - Deletes all user files from Firebase Storage.
 *
 * This function is callable from the client-side by an authenticated admin.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
    // 1. Authentication and Authorization Check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "You must be logged in to call this function."
        );
    }

    const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";
    if (context.auth.token.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
         throw new functions.httpshttps.HttpsError(
            "permission-denied",
            "You must be an admin to delete a user."
        );
    }

    const userIdToDelete = data.userId;
    if (!userIdToDelete || typeof userIdToDelete !== 'string') {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with a valid 'userId'."
        );
    }

    try {
        // 2. Delete user from Firebase Authentication
        await auth.deleteUser(userIdToDelete).catch((error) => {
            // If user not found in auth, we can still proceed with DB cleanup
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
            console.log(`Auth user ${userIdToDelete} not found, proceeding with database cleanup.`);
        });

        const batch = db.batch();

        // 3. Delete user's main document and their primary subcollections
        const userDocRef = db.collection("users").doc(userIdToDelete);
        
        const userSubcollections = ["notifications", "userPlans", "vipMailbox", "airdrop_claims"];
        for (const subcollection of userSubcollections) {
            const snapshot = await userDocRef.collection(subcollection).get();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        }
        batch.delete(userDocRef);
        
        // 4. Delete related data from top-level collections
        const collectionsToClean = [
            { name: "deposits", field: "uid" },
            { name: "withdrawals", field: "userId" },
            { name: "cpmWithdrawals", field: "userId" },
            { name: "cpm_purchase_logs", field: "userId" },
            { name: "activityLogs", field: "userId" },
            { name: "feedback", field: "userId" },
            { name: "kycSubmissions", field: "userId" },
            { name: "supportTickets", field: "userId" },
        ];

        for (const { name, field } of collectionsToClean) {
            const snapshot = await db.collection(name).where(field, "==", userIdToDelete).get();
            for (const doc of snapshot.docs) {
                 batch.delete(doc.ref);
                 // Special handling for supportTickets subcollection
                 if (name === 'supportTickets') {
                     const repliesSnapshot = await doc.ref.collection('replies').get();
                     repliesSnapshot.forEach(replyDoc => batch.delete(replyDoc.ref));
                 }
            }
        }
        
        // Delete from cpm_coins collection where doc ID is the userId
        const cpmCoinDocRef = db.collection("cpm_coins").doc(userIdToDelete);
        batch.delete(cpmCoinDocRef);

        // 5. Commit all Firestore deletions
        await batch.commit();

        // 6. Delete user files from Firebase Storage
        const bucket = storage.bucket();
        // Delete KYC documents
        await bucket.deleteFiles({ prefix: `kyc_documents/${userIdToDelete}/` }).catch((e) => console.warn(`Storage cleanup for kyc_documents/${userIdToDelete}/ failed:`, e.message));
        // Delete deposit screenshots
        await bucket.deleteFiles({ prefix: `deposit_screenshots/${userIdToDelete}/` }).catch((e) => console.warn(`Storage cleanup for deposit_screenshots/${userIdToDelete}/ failed:`, e.message));

        return { success: true, message: `Successfully deleted user ${userIdToDelete} and all their data.` };

    } catch (error: any) {
        console.error("Error deleting user:", error);
        throw new functions.https.HttpsError(
            "internal",
            `An error occurred while deleting the user: ${error.message}`
        );
    }
});
