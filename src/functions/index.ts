
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Correctly initialize the Firebase Admin SDK.
// This was the missing line causing the "Internal Server Error".
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

/**
 * Deletes all documents in a collection or subcollection.
 */
async function deleteCollection(collectionPath: string, batchSize: number): Promise<void> {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(query: admin.firestore.Query, resolve: (value: unknown) => void): Promise<void> {
  const snapshot = await query.get();

  if (snapshot.size === 0) {
    resolve(0);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve);
  });
}

/**
 * Deletes a user and all their associated data across Firebase services.
 * This is an HTTPS Callable function, designed to be called from the client-side by an admin.
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
    throw new functions.https.HttpsError(
      "permission-denied",
      "You must be an admin to delete a user."
    );
  }

  const userIdToDelete = data.userId;
  if (!userIdToDelete || typeof userIdToDelete !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "The function must be called with a valid 'userId'."
    );
  }

  try {
    // 2. Delete from Firebase Authentication
    // We catch the error in case the auth user was already deleted, but data remains.
    await auth.deleteUser(userIdToDelete).catch((error) => {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
      console.log(`Auth user ${userIdToDelete} not found, proceeding with database cleanup.`);
    });

    // 3. Delete Firestore Data
    const firestorePaths = [
      `users/${userIdToDelete}/notifications`,
      `users/${userIdToDelete}/userPlans`,
      `users/${userIdToDelete}/vipMailbox`,
      `users/${userIdToDelete}/airdrop_claims`
    ];
    
    // Delete all known subcollections recursively
    for (const path of firestorePaths) {
        await deleteCollection(path, 100);
    }
    
    // Delete documents from top-level collections
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
        if (!snapshot.empty) {
            const batch = db.batch();
            for (const doc of snapshot.docs) {
                // If it's a support ticket, also delete its subcollection
                if (name === 'supportTickets') {
                    await deleteCollection(`supportTickets/${doc.id}/replies`, 100);
                }
                batch.delete(doc.ref);
            }
            await batch.commit();
        }
    }
    
    // Delete the main user document and cpm_coin document
    await db.collection("users").doc(userIdToDelete).delete();
    await db.collection("cpm_coins").doc(userIdToDelete).delete();

    // 4. Delete user files from Firebase Storage
    const bucket = storage.bucket();
    // No need to check for existence, deleteFiles is safe
    await bucket.deleteFiles({ prefix: `kyc_documents/${userIdToDelete}/` });
    await bucket.deleteFiles({ prefix: `deposit_screenshots/${userIdToDelete}/` });


    return { success: true, message: `Successfully deleted user ${userIdToDelete} and all their data.` };

  } catch (error: any) {
    console.error("Error deleting user:", error);
    // Throw a specific error for the client to handle
    throw new functions.https.HttpsError(
      "internal",
      `An error occurred while deleting the user: ${error.message}`
    );
  }
});
