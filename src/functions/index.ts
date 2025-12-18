
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * Handles admin-initiated tasks like deleting a user.
 * This new version is more robust with better error handling.
 */
export const handleAdminAction = functions.runWith({timeoutSeconds: 120, memory: '256MB'}).firestore
  .document('actions/{actionId}')
  .onCreate(async (snap) => {
    const action = snap.data();

    if (action.action === 'deleteUser') {
      const { userId } = action;

      if (!userId) {
        functions.logger.error('Action "deleteUser" is missing userId.', { actionId: snap.id });
        await snap.ref.update({ status: 'error', error: 'Missing userId.' });
        return;
      }

      functions.logger.log(`Starting deletion for user: ${userId}`, { actionId: snap.id });

      // Step 1: Delete user from Firebase Authentication
      try {
        await auth.deleteUser(userId);
        functions.logger.log(`Successfully deleted auth user: ${userId}`, { actionId: snap.id });
      } catch (error: any) {
        // If the user is already deleted from Auth, it's not a critical failure.
        // We can proceed to delete their Firestore data.
        if (error.code === 'auth/user-not-found') {
          functions.logger.warn(`Auth user ${userId} not found, proceeding with DB cleanup.`, { actionId: snap.id });
        } else {
          // For other auth errors, log it and stop.
          functions.logger.error(`Error deleting auth user ${userId}:`, error, { actionId: snap.id });
          await snap.ref.update({ status: 'error', error: `Auth deletion failed: ${error.message}` });
          return;
        }
      }

      // Step 2: Delete Firestore documents in a batch
      try {
        const batch = db.batch();

        const userDocRef = db.collection('users').doc(userId);
        const cpmCoinDocRef = db.collection('cpm_coins').doc(userId);

        batch.delete(userDocRef);
        batch.delete(cpmCoinDocRef);

        await batch.commit();
        functions.logger.log(`Deleted main Firestore documents for: ${userId}`, { actionId: snap.id });
      } catch (error: any) {
        functions.logger.error(`Error deleting Firestore data for ${userId}:`, error, { actionId: snap.id });
        await snap.ref.update({ status: 'error', error: `Firestore cleanup failed: ${error.message}` });
        return;
      }
        
      // Final Step: Mark the action as completed
      await snap.ref.update({ status: 'completed' });
      functions.logger.log(`Action deleteUser for ${userId} completed successfully.`, { actionId: snap.id });
    }
  });
