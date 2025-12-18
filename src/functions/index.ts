
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

export const deleteUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be an authenticated admin to call this function.'
    );
  }

  const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";
  if (context.auth.token.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You do not have permission to delete a user.'
    );
  }
  
  const userIdToDelete = data.userId;
  if (!userIdToDelete) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'The function must be called with a "userId" argument.'
    );
  }

  try {
    // Delete user from Authentication
    await auth.deleteUser(userIdToDelete);
    functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);

    // Delete user's main document in Firestore
    const userDocRef = db.collection('users').doc(userIdToDelete);
    await userDocRef.delete();
    functions.logger.log(`Successfully deleted user document for: ${userIdToDelete}`);
    
    // Optionally delete cpm_coins document
    const cpmCoinDocRef = db.collection('cpm_coins').doc(userIdToDelete);
    await cpmCoinDocRef.delete().catch(err => functions.logger.warn(`Could not delete cpm_coin doc for ${userIdToDelete}, it might not exist.`));

    return { success: true, message: `Successfully deleted user ${userIdToDelete}.` };
    
  } catch (error: any) {
    functions.logger.error(`Error deleting user ${userIdToDelete}:`, error);
    
    // If user is already deleted in Auth, we can consider it a success for cleanup purposes
    if (error.code === 'auth/user-not-found') {
        functions.logger.warn(`Auth user ${userIdToDelete} not found, but proceeding with cleanup.`);
        // Attempt to delete firestore data anyway
        const userDocRef = db.collection('users').doc(userIdToDelete);
        await userDocRef.delete().catch(e => functions.logger.error('Error deleting user doc after auth error:', e));
        return { success: true, message: 'User already deleted from auth, cleaned up Firestore.' };
    }
    
    throw new functions.https.HttpsError('internal', error.message, error);
  }
});

// The resetUserAccount function is no longer needed with the simplified approach.
// It is removed to keep the code clean.
