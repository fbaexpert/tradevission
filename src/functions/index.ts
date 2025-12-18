
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * Deletes a user from Firebase Authentication.
 * This is a simplified function to avoid timeouts and complexity.
 * It only deletes the auth record. Firestore data is left for manual review.
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

  functions.logger.log(`Admin ${context.auth.uid} initiating auth deletion for user: ${userIdToDelete}`);

  try {
    // Delete user from Firebase Authentication
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
    
    // Also delete the user's main document and cpm_coins document
    const userDocRef = db.doc(`users/${userIdToDelete}`);
    const cpmCoinDocRef = db.doc(`cpm_coins/${userIdToDelete}`);
    
    const batch = db.batch();
    batch.delete(userDocRef);
    batch.delete(cpmCoinDocRef);
    
    await batch.commit();
    functions.logger.log(`Deleted core Firestore documents for user ${userIdToDelete}`);

    return { success: true, message: `Successfully deleted user ${userIdToDelete}.` };

  } catch (error: any) {
    functions.logger.error(`Failed to delete user ${userIdToDelete}:`, error);
    
    if (error.code === 'auth/user-not-found') {
        functions.logger.warn(`Auth user ${userIdToDelete} was not found, but proceeding.`);
        return { success: true, message: `User auth record not found, but data may have been cleaned up.` };
    }

    throw new functions.https.HttpsError(
        "internal",
        `An internal error occurred: ${error.message}`
    );
  }
});
