
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

/**
 * Deletes a user and their core data from Firebase services.
 * This is a simplified and more robust version to avoid timeouts.
 */
export const deleteUser = functions.https.onCall(async (data, context) => {
  // 1. Authentication and Authorization Check
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be logged in to call this function.'
    );
  }

  const ADMIN_EMAIL = 'ummarfarooq38990@gmail.com';
  if (context.auth.token.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to delete a user.'
    );
  }

  const userIdToDelete = data.userId;
  if (!userIdToDelete || typeof userIdToDelete !== 'string') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a valid "userId" string.'
    );
  }

  functions.logger.log(`Admin ${context.auth.uid} initiating deletion for user: ${userIdToDelete}`);

  try {
    const batch = db.batch();
    
    // Core user documents to delete
    const userDocRef = db.doc(`users/${userIdToDelete}`);
    const cpmCoinDocRef = db.doc(`cpm_coins/${userIdToDelete}`);
    
    batch.delete(userDocRef);
    batch.delete(cpmCoinDocRef);
    
    // Note: This simplified version does not recursively delete all related data
    // to prevent timeouts. Associated data like deposits, withdrawals will remain
    // but will be orphaned. This can be cleaned up via other means if necessary.

    await batch.commit();
    functions.logger.log(`Deleted Firestore documents for user ${userIdToDelete}`);
    
    // Delete user from Firebase Authentication
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
    
    return { success: true, message: `Successfully deleted user ${userIdToDelete}.` };

  } catch (error: any) {
    functions.logger.error(`Failed to delete user ${userIdToDelete}:`, error);
    // Gracefully handle if user is already deleted from auth
    if (error.code === 'auth/user-not-found') {
        functions.logger.warn(`Auth user ${userIdToDelete} was not found, but proceeding as success.`);
        return { success: true, message: `User auth record not found, but data was cleaned up.` };
    }
    throw new functions.https.HttpsError(
        "internal",
        `An internal error occurred: ${error.message}`
    );
  }
});


/**
 * Resets a user's financial and activity data without deleting their account.
 */
export const resetUserAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth || context.auth.token.email?.toLowerCase() !== 'ummarfarooq38990@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to perform this action.');
    }

    const userId = data.userId;
    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "userId".');
    }

    const batch = db.batch();
    const userRef = db.doc(`users/${userId}`);

    // Reset balances and stats
    batch.update(userRef, {
        balance0: 0,
        totalWithdrawn: 0,
        totalReferralBonus: 0,
        totalTeamBonus: 0,
        totalTeamDeposit: 0,
        totalTeamMembers: 0,
        awardedSuperBonuses: [],
        depositDone: false,
    });
    
    // Delete subcollections
    const collectionsToDelete = ['notifications', 'airdrop_claims', 'vipMailbox'];
    for (const subcollection of collectionsToDelete) {
        const snapshot = await db.collection(`users/${userId}/${subcollection}`).get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }
    
    // Delete related top-level collections
    const relatedCollections = ['userPlans', 'supportTickets', 'feedback', 'deposits', 'withdrawals', 'cpmWithdrawals', 'activityLogs'];
    for (const collectionName of relatedCollections) {
        const q = db.collection(collectionName).where('userId', '==', userId);
        const snapshot = await q.get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
    }

    try {
        await batch.commit();
        functions.logger.log(`Successfully reset account for user: ${userId}`);
        return { success: true, message: 'User account has been reset.' };
    } catch (error: any) {
        functions.logger.error(`Failed to reset user account ${userId}:`, error);
        throw new functions.https.HttpsError('internal', `Failed to reset user account: ${error.message}`);
    }
});
