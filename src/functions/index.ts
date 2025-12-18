
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();

/**
 * A background function triggered when a document is created in the 'actions' collection.
 * It handles admin-initiated tasks like deleting a user.
 */
export const handleAdminAction = functions.firestore
  .document('actions/{actionId}')
  .onCreate(async (snap, context) => {
    const action = snap.data();

    if (action.action === 'deleteUser') {
      const { userId } = action;

      if (!userId) {
        functions.logger.error('Action "deleteUser" is missing userId.');
        await snap.ref.update({ status: 'error', error: 'Missing userId.' });
        return;
      }

      try {
        // Step 1: Delete from Firebase Authentication
        await auth.deleteUser(userId);
        functions.logger.log(`Successfully deleted auth user: ${userId}`);

        // Step 2: Delete user's main document in Firestore
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.delete();
        functions.logger.log(`Successfully deleted user document for: ${userId}`);

        // Step 3: Delete CPM coins document
        const cpmCoinDocRef = db.collection('cpm_coins').doc(userId);
        await cpmCoinDocRef.delete();
        functions.logger.log(`Successfully deleted cpm_coins document for: ${userId}`);

        // Step 4: Update the action status to 'completed'
        await snap.ref.update({ status: 'completed' });
        functions.logger.log(`Action deleteUser for ${userId} completed successfully.`);

      } catch (error: any) {
        functions.logger.error(`Error processing deleteUser action for ${userId}:`, error);
        
        let errorMessage = error.message;
        if (error.code === 'auth/user-not-found') {
          // If auth user is already gone, still try to clean up and mark as success
           const userDocRef = db.collection('users').doc(userId);
           await userDocRef.delete().catch(e => functions.logger.error('Cleanup delete of user doc failed:', e));
           const cpmCoinDocRef = db.collection('cpm_coins').doc(userId);
           await cpmCoinDocRef.delete().catch(e => functions.logger.error('Cleanup delete of cpm coin doc failed:', e));
           await snap.ref.update({ status: 'completed', details: 'Auth user not found, but DB cleanup attempted.' });
           return;
        }

        await snap.ref.update({ status: 'error', error: errorMessage });
      }
    }
  });

    