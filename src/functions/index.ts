import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Correctly initialize the Firebase Admin SDK.
// This is the most important line for the function to work.
admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

/**
 * Deletes all documents in a collection or subcollection in batches.
 * @param {string} collectionPath The path to the collection to delete.
 * @param {number} batchSize The number of documents to delete in each batch.
 */
async function deleteCollection(collectionPath: string, batchSize: number): Promise<void> {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy("__name__").limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve).catch(reject);
  });
}

/**
 * Helper function for deleteCollection that recursively deletes documents in a batch.
 * @param {admin.firestore.Query} query The query for the batch of documents to delete.
 * @param {Function} resolve The promise's resolve function.
 */
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

  // Recurse on the next process tick, to avoid hitting memory limits.
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

  // 2. Delete from Firebase Authentication
  try {
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
  } catch (error: any) {
    if (error.code !== "auth/user-not-found") {
      throw new functions.https.HttpsError("internal", `Failed to delete auth user: ${error.message}`);
    }
    functions.logger.warn(`Auth user ${userIdToDelete} not found, proceeding with database cleanup.`);
  }

  // 3. Delete Firestore Data
  try {
    const firestorePaths = [
      `users/${userIdToDelete}/notifications`,
      `users/${userIdToDelete}/userPlans`,
      `users/${userIdToDelete}/vipMailbox`,
      `users/${userIdToDelete}/airdrop_claims`,
      `users/${userIdToDelete}/supportTickets`,
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
    
    const rootBatch = db.batch();

    for (const { name, field } of collectionsToClean) {
        const snapshot = await db.collection(name).where(field, "==", userIdToDelete).get();
        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                if (name === 'supportTickets') {
                    await deleteCollection(`supportTickets/${doc.id}/replies`, 100);
                }
                rootBatch.delete(doc.ref);
            }
        }
    }
    
    // Delete the main user document and cpm_coin document
    rootBatch.delete(db.collection("users").doc(userIdToDelete));
    rootBatch.delete(db.collection("cpm_coins").doc(userIdToDelete));
    
    await rootBatch.commit();
    functions.logger.log(`Successfully deleted Firestore data for user: ${userIdToDelete}`);

  } catch (error: any) {
      functions.logger.error("Error deleting Firestore data:", error);
      throw new functions.https.HttpsError("internal", `Failed to delete Firestore data: ${error.message}`);
  }

  // 4. Delete user files from Firebase Storage
  try {
    const bucket = storage.bucket();
    await bucket.deleteFiles({ prefix: `kyc_documents/${userIdToDelete}/` });
    await bucket.deleteFiles({ prefix: `deposit_screenshots/${userIdToDelete}/` });
    functions.logger.log(`Successfully deleted Storage files for user: ${userIdToDelete}`);
  } catch (error: any) {
      if (error.code !== 404) { // Ignore 'Not Found' errors
          functions.logger.error("Error deleting Storage files:", error);
          throw new functions.https.HttpsError("internal", `Failed to delete Storage files: ${error.message}`);
      }
  }

  return { success: true, message: `Successfully deleted user ${userIdToDelete} and all their data.` };
});
