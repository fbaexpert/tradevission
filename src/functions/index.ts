
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

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

  // 3. Delete Firestore Data
  try {
    // A) Delete all subcollections first
    const userSubcollections = [
      "notifications",
      "vipMailbox",
      "airdrop_claims",
    ];
    for (const subcollection of userSubcollections) {
        await deleteCollection(`users/${userIdToDelete}/${subcollection}`, 100);
    }
     // Special handling for nested subcollections like support tickets
    const supportTicketsSnapshot = await db.collection("supportTickets").where("userId", "==", userIdToDelete).get();
    for (const ticketDoc of supportTicketsSnapshot.docs) {
        await deleteCollection(`supportTickets/${ticketDoc.id}/replies`, 100);
    }


    // B) Batch delete all top-level documents associated with the user
    const rootBatch = db.batch();
    const collectionsToClean = [
        { name: "deposits", field: "uid" },
        { name: "withdrawals", field: "userId" },
        { name: "cpmWithdrawals", field: "userId" },
        { name: "cpm_purchase_logs", field: "userId" },
        { name: "activityLogs", field: "userId" },
        { name: "feedback", field: "userId" },
        { name: "kycSubmissions", field: "userId" },
        { name: "userPlans", field: "userId" }
    ];

    for (const { name, field } of collectionsToClean) {
        const snapshot = await db.collection(name).where(field, "==", userIdToDelete).get();
        if (!snapshot.empty) {
            snapshot.docs.forEach((doc) => rootBatch.delete(doc.ref));
        }
    }
    
    // Also delete from the already cleaned support tickets collection
    supportTicketsSnapshot.docs.forEach((doc) => rootBatch.delete(doc.ref));

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
          // Do not throw an error for storage deletion failure, just log it.
      }
  }
  
    // 2. Delete from Firebase Authentication (do this LAST)
  try {
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
  } catch (error: any) {
    if (error.code !== "auth/user-not-found") {
      functions.logger.error(`Failed to delete auth user: ${error.message}`);
      // Don't throw an error if the user is already gone, but do for other errors
      if(error.code !== 'auth/user-not-found'){
         throw new functions.https.HttpsError("internal", `Failed to delete auth user: ${error.message}`);
      }
    }
    functions.logger.warn(`Auth user ${userIdToDelete} not found, but data cleanup was successful.`);
  }


  return { success: true, message: `Successfully deleted user ${userIdToDelete} and all their data.` };
});


/**
 * Resets a user's account data without deleting their authentication entry.
 */
export const resetUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "You must be logged in.");
  }
  const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";
  if (context.auth.token.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new functions.https.HttpsError("permission-denied", "You must be an admin.");
  }
  const userIdToReset = data.userId;
  if (!userIdToReset) {
    throw new functions.https.HttpsError("invalid-argument", "Missing 'userId'.");
  }

  try {
    const batch = db.batch();
    const userRef = db.doc(`users/${userIdToReset}`);

    // 1. Reset main user document fields
    batch.update(userRef, {
      balance0: 0,
      totalWithdrawn: 0,
      totalReferralBonus: 0,
      totalTeamBonus: 0,
      totalTeamDeposit: 0,
      depositDone: false,
      isCommander: false,
      isVip: false,
      awardedSuperBonuses: [],
      customBadges: [],
    });

    // 2. Delete related top-level documents
    const collectionsToClean = [
        { name: "deposits", field: "uid" },
        { name: "withdrawals", field: "userId" },
        { name: "cpmWithdrawals", field: "userId" },
        { name: "cpm_purchase_logs", field: "userId" },
        { name: "activityLogs", field: "userId" },
        { name: "feedback", field: "userId" },
        { name: "kycSubmissions", field: "userId" },
        { name: "userPlans", field: "userId" },
    ];
    for (const { name, field } of collectionsToClean) {
        const snapshot = await db.collection(name).where(field, "==", userIdToReset).get();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    }
    
    // Also find and delete support tickets
    const supportTicketsSnapshot = await db.collection('supportTickets').where('userId', '==', userIdToReset).get();
    for (const ticketDoc of supportTicketsSnapshot.docs) {
      await deleteCollection(`supportTickets/${ticketDoc.id}/replies`, 100);
      batch.delete(ticketDoc.ref);
    }


    // 3. Delete user's CPM coin document
    batch.delete(db.doc(`cpm_coins/${userIdToReset}`));
    
    await batch.commit();

    // 4. Delete subcollections (must be done after batch commit)
    const subcollectionsToDelete = [
      "notifications",
      "vipMailbox",
      "airdrop_claims",
    ];
    for (const sub of subcollectionsToDelete) {
      await deleteCollection(`users/${userIdToReset}/${sub}`, 100);
    }
     

    // 5. Log the action
    await db.collection("activityLogs").add({
      userId: 'ADMIN',
      action: 'account_reset',
      details: `Admin reset account for user ${userIdToReset}.`,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      relatedId: userIdToReset
    });

    functions.logger.log(`Successfully reset data for user: ${userIdToReset}`);
    return { success: true, message: "User account has been reset." };

  } catch (error: any) {
    functions.logger.error("Error resetting user account:", error);
    throw new functions.https.HttpsError("internal", `Failed to reset user: ${error.message}`);
  }
});
