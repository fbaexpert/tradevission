
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

/**
 * Recursively deletes a collection and all its subcollections.
 */
async function deleteCollection(collectionRef: admin.firestore.CollectionReference, batchSize: number) {
  const query = collectionRef.limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(query, resolve, reject);
  });
}

async function deleteQueryBatch(query: admin.firestore.Query, resolve: (value: unknown) => void, reject: (reason?: any) => void) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve(true);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  process.nextTick(() => {
    deleteQueryBatch(query, resolve, reject);
  });
}

/**
 * Deletes all documents in a collection where a specific field matches the userId.
 */
async function deleteUserDocuments(collectionName: string, userId: string, userField: string = 'userId') {
  const collectionRef = db.collection(collectionName);
  const query = collectionRef.where(userField, '==', userId);
  const snapshot = await query.get();

  if (snapshot.empty) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}


/**
 * Handles admin-initiated tasks like deleting a user and all their associated data.
 */
export const handleAdminAction = functions.runWith({timeoutSeconds: 540, memory: '1GB'}).firestore
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
        functions.logger.log(`Starting deletion for user: ${userId}`);

        // --- Step 1: Delete all subcollections inside the user document ---
        const userSubCollections = ['notifications', 'airdrop_claims', 'vipMailbox'];
        for (const sub of userSubCollections) {
            const subCollectionRef = db.collection('users').doc(userId).collection(sub);
            await deleteCollection(subCollectionRef, 100);
            functions.logger.log(`Deleted subcollection: users/${userId}/${sub}`);
        }

        // --- Step 2: Delete user's documents from other top-level collections ---
        // Note: For collections with subcollections, those must be handled first.
        const supportTicketsQuery = db.collection('supportTickets').where('userId', '==', userId);
        const supportTicketsSnapshot = await supportTicketsQuery.get();
        for (const ticketDoc of supportTicketsSnapshot.docs) {
            await deleteCollection(ticketDoc.ref.collection('replies'), 100);
            await ticketDoc.ref.delete();
            functions.logger.log(`Deleted support ticket and replies: ${ticketDoc.id}`);
        }
        
        await deleteUserDocuments('userPlans', userId);
        functions.logger.log(`Deleted documents from userPlans for user: ${userId}`);

        await deleteUserDocuments('deposits', userId, 'uid');
        functions.logger.log(`Deleted documents from deposits for user: ${userId}`);
        
        await deleteUserDocuments('withdrawals', userId);
        functions.logger.log(`Deleted documents from withdrawals for user: ${userId}`);
        
        await deleteUserDocuments('cpmWithdrawals', userId);
        functions.logger.log(`Deleted documents from cpmWithdrawals for user: ${userId}`);
        
        await deleteUserDocuments('cpm_purchase_logs', userId);
        functions.logger.log(`Deleted documents from cpm_purchase_logs for user: ${userId}`);
        
        await deleteUserDocuments('feedback', userId);
        functions.logger.log(`Deleted documents from feedback for user: ${userId}`);

        await deleteUserDocuments('kycSubmissions', userId);
        functions.logger.log(`Deleted documents from kycSubmissions for user: ${userId}`);

        await deleteUserDocuments('activityLogs', userId);
        functions.logger.log(`Deleted documents from activityLogs for user: ${userId}`);
        
        // --- Step 3: Delete top-level user documents ---
        await db.collection('cpm_coins').doc(userId).delete();
        functions.logger.log(`Deleted cpm_coins document for: ${userId}`);
        
        await db.collection('users').doc(userId).delete();
        functions.logger.log(`Deleted main user document for: ${userId}`);

        // --- Step 4: Delete user's files from Cloud Storage ---
        const bucket = storage.bucket();
        await bucket.deleteFiles({ prefix: `deposit_screenshots/${userId}/` });
        functions.logger.log(`Deleted storage files in deposit_screenshots for user: ${userId}`);
        await bucket.deleteFiles({ prefix: `kyc_documents/${userId}/` });
        functions.logger.log(`Deleted storage files in kyc_documents for user: ${userId}`);

        // --- Step 5: Delete user from Firebase Authentication ---
        await auth.deleteUser(userId);
        functions.logger.log(`Successfully deleted auth user: ${userId}`);

        // --- Final Step: Update the action status to 'completed' ---
        await snap.ref.update({ status: 'completed' });
        functions.logger.log(`Action deleteUser for ${userId} completed successfully.`);

      } catch (error: any) {
        functions.logger.error(`Error processing deleteUser action for ${userId}:`, error);
        
        // If auth user is already gone, it's a partial success.
        if (error.code === 'auth/user-not-found') {
           await snap.ref.update({ status: 'completed', details: 'Auth user not found, but DB cleanup finished.' });
           return;
        }

        await snap.ref.update({ status: 'error', error: error.message });
      }
    }
  });
