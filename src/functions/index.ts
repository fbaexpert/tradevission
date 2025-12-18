
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

/**
 * A callable function that deletes a user account from Firebase Authentication and their main documents from Firestore.
 * This function is designed to be fast and reliable.
 */
export const deleteUserAccount = functions.runWith({timeoutSeconds: 60, memory: '256MB'}).https.onCall(async (data, context) => {
    // Check if the request is made by an authenticated admin user.
    // Note: You must set a custom claim `isAdmin: true` on your admin user's token for this to work.
    if (context.auth?.token.isAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete user accounts.');
    }

    const uid = data.uid;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "uid" argument.');
    }

    try {
        // Step 1: Delete user from Firebase Authentication
        await admin.auth().deleteUser(uid);
        functions.logger.log(`Successfully deleted auth user: ${uid}`);
    } catch (error: any) {
        // If the user is already deleted, it's not a critical error.
        // We still want to proceed to delete their Firestore data.
        if (error.code === 'auth/user-not-found') {
          functions.logger.warn(`Auth user ${uid} not found, but proceeding with DB cleanup.`);
        } else {
          // For other auth errors, re-throw the error to the client.
          functions.logger.error(`Error deleting auth user ${uid}:`, error);
          throw new functions.https.HttpsError('internal', 'Failed to delete user from authentication service.');
        }
    }

    try {
        // Step 2: Delete associated Firestore documents in a batch
        const batch = admin.firestore().batch();

        const userDocRef = admin.firestore().collection('users').doc(uid);
        const cpmCoinDocRef = admin.firestore().collection('cpm_coins').doc(uid);
        
        batch.delete(userDocRef);
        batch.delete(cpmCoinDocRef);

        await batch.commit();
        functions.logger.log(`Successfully deleted Firestore documents for user: ${uid}`);
    } catch (error: any) {
        functions.logger.error(`Error deleting Firestore data for user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to clean up user data from database.');
    }

    return { success: true, message: `Successfully deleted user ${uid}` };
});
