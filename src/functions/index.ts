
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
 */
export const handleAdminAction = functions.runWith({timeoutSeconds: 60, memory: '256MB'}).firestore
  .document('actions/{actionId}')
  .onCreate(async (snap) => {
    const action = snap.data();

    if (action.action === 'deleteUser') {
      const { userId } = action;

      if (!userId) {
        functions.logger.error('Action "deleteUser" is missing userId.');
        await snap.ref.update({ status: 'error', error: 'Missing userId.' });
        return;
      }

      try {
        functions.logger.log(`Starting deletion for user: ${userId}`);

        // Step 1: Delete user from Firebase Authentication
        await auth.deleteUser(userId);
        functions.logger.log(`Successfully deleted auth user: ${userId}`);

        const batch = db.batch();

        // Step 2: Delete main user document from Firestore
        const userDocRef = db.collection('users').doc(userId);
        batch.delete(userDocRef);

        // Step 3 (Optional but good practice): Delete associated CPM coin document
        const cpmCoinDocRef = db.collection('cpm_coins').doc(userId);
        batch.delete(cpmCoinDocRef);

        await batch.commit();
        functions.logger.log(`Deleted Firestore documents for: ${userId}`);
        
        // Final Step: Update the action status to 'completed'
        await snap.ref.update({ status: 'completed' });
        functions.logger.log(`Action deleteUser for ${userId} completed successfully.`);

      } catch (error: any) {
        functions.logger.error(`Error processing deleteUser action for ${userId}:`, error);
        
        // If auth user is already gone, it's a partial success, we can still consider it completed.
        if (error.code === 'auth/user-not-found') {
           await snap.ref.update({ status: 'completed', details: 'Auth user already deleted, DB cleanup finished.' });
           return;
        }

        await snap.ref.update({ status: 'error', error: error.message });
      }
    }
  });
