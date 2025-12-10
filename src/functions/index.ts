
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

/**
 * Deletes a user and all their associated data across Firebase services.
 * - Deletes from Firebase Authentication.
 * - Deletes the user document from Firestore.
 * - Deletes all related data in other collections (deposits, withdrawals, plans, etc.).
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
    
    // Check if the caller is an admin (replace with your admin logic, e.g., custom claims)
    const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";
    if (context.auth.token.email !== ADMIN_EMAIL) {
         throw new functions.https.HttpsError(
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
        // 2. Delete from Firebase Authentication
        await auth.deleteUser(userIdToDelete);

        const batch = db.batch();

        // 3. Delete user's main document
        const userDocRef = db.collection("users").doc(userIdToDelete);
        batch.delete(userDocRef);

        // 4. Delete related data from various collections
        const collectionsToDelete = [
            "notifications",
            "userPlans",
            "vipMailbox",
            "airdrop_claims",
            "activityLogs",
            "feedback",
            "supportTickets",
            "deposits",
            "withdrawals",
            "cpmWithdrawals",
            "kycSubmissions"
        ];
        
        const queryPromises = collectionsToDelete.map(async (collectionName) => {
            const field = ['deposits'].includes(collectionName) ? 'uid' : 'userId';
            const snapshot = await db.collection(collectionName).where(field, "==", userIdToDelete).get();
            snapshot.forEach((doc) => {
                batch.delete(doc.ref);
                // If a collection has subcollections, they must also be deleted (e.g., support tickets)
                if (collectionName === 'supportTickets') {
                    db.collection('supportTickets').doc(doc.id).collection('replies').get().then(replies => {
                        replies.forEach(reply => batch.delete(reply.ref));
                    });
                }
            });
        });

        // Delete from cpm_coins collection where doc ID is the userId
        const cpmCoinDocRef = db.collection("cpm_coins").doc(userIdToDelete);
        batch.delete(cpmCoinDocRef);

        // Wait for all queries to finish adding deletes to the batch
        await Promise.all(queryPromises);

        // 5. Commit all deletions
        await batch.commit();

        return { success: true, message: `Successfully deleted user ${userIdToDelete}` };
    } catch (error: any) {
        console.error("Error deleting user:", error);
        if (error.code === 'auth/user-not-found') {
            // If auth user is already gone, still try to clean up DB
            return { success: true, message: `User auth record not found, but cleanup attempted.` };
        }
        throw new functions.https.HttpsError(
            "internal",
            `An error occurred: ${error.message}`
        );
    }
});
