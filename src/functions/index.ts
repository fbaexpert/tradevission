
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK.
// This is required for the function to interact with Firebase services.
admin.initializeApp();

const auth = admin.auth();

/**
 * Deletes a user from Firebase Authentication.
 * This is an HTTPS Callable function, designed to be called from the client-side by an admin.
 * Firestore data and Storage files will be cleaned up via Security Rules and Lifecycle Policies.
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
      "The function must be called with a valid 'userId' string."
    );
  }

  functions.logger.log(`Attempting to delete auth user: ${userIdToDelete}`);

  // 2. Delete from Firebase Authentication
  try {
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
    return { success: true, message: `Successfully deleted user ${userIdToDelete}.` };
  } catch (error: any) {
    functions.logger.error(`Failed to delete auth user ${userIdToDelete}:`, error);

    // If the user is already not found in Auth, it's not a critical error.
    if (error.code === "auth/user-not-found") {
      functions.logger.warn(`Auth user ${userIdToDelete} was not found. They may have already been deleted.`);
      return { success: true, message: "User was not found in authentication, but the deletion process is complete." };
    }

    // For other errors, throw a specific HTTPS error.
    throw new functions.https.HttpsError(
        "internal",
        `Failed to delete user from Authentication: ${error.message}`
    );
  }
});


/**
 * Resets a user's account data without deleting their authentication entry.
 * This function remains as it was, as it is a different use case.
 */
export const resetUserAccount = functions.https.onCall(async (data, context) => {
  const db = admin.firestore();

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
      // Note: This won't delete subcollections. Manual cleanup or a separate function needed for ticket replies.
      batch.delete(ticketDoc.ref);
    }

    // 3. Delete user's CPM coin document
    batch.delete(db.doc(`cpm_coins/${userIdToReset}`));
    
    await batch.commit();

    // 4. Log the action
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
