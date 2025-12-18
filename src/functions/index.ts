/**
 * IMPORTANT:
 * To make this function work, you must create a service account and add it to your environment.
 * 1. Go to Firebase Console > Project Settings > Service accounts.
 * 2. Click "Generate new private key" and save the JSON file.
 * 3. Open the downloaded JSON file, copy its entire content.
 * 4. Paste the content into the .env file in your project's root directory:
 *    GOOGLE_APPLICATION_CREDENTIALS='{"type": "service_account", "project_id": "...", ...}'
 *
 * This function will now have the necessary admin privileges to delete users.
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Initialize Firebase Admin SDK if not already initialized
if (admin.apps.length === 0) {
  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS!);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: `${serviceAccount.project_id}.appspot.com`,
    });
  } catch (e: any) {
    console.error(
      'Failed to initialize Firebase Admin SDK. Make sure GOOGLE_APPLICATION_CREDENTIALS is set correctly in your .env file.',
      e.message
    );
  }
}

const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage();

/**
 * Deletes a user and all their associated data from Firebase services.
 * This is an HTTPS Callable function, designed to be called from the client-side by an admin.
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
    // Step 2: Delete user's Firestore data recursively.
    const collectionsToDelete = [
      `users/${userIdToDelete}/notifications`,
      `users/${userIdToDelete}/airdrop_claims`,
      `users/${userIdToDelete}/vipMailbox`,
      'userPlans',
      'supportTickets',
      'feedback',
      'deposits',
      'withdrawals',
      'cpmWithdrawals',
      'activityLogs',
      'kycSubmissions',
    ];

    for (const collectionPath of collectionsToDelete) {
        const fieldToQuery = collectionPath.startsWith(`users/${userIdToDelete}`) ? null : 'userId';
        
        let query: admin.firestore.Query;
        if(fieldToQuery) {
            query = db.collection(collectionPath).where(fieldToQuery, '==', userIdToDelete);
        } else {
            query = db.collection(collectionPath);
        }
        
        const snapshot = await query.get();
        if (!snapshot.empty) {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            functions.logger.log(`Deleted ${snapshot.size} documents from ${collectionPath} for user ${userIdToDelete}`);
        }
    }
    
    // Delete the main user document and cpm_coins document
    const userDocRef = db.doc(`users/${userIdToDelete}`);
    const cpmCoinDocRef = db.doc(`cpm_coins/${userIdToDelete}`);
    await db.batch().delete(userDocRef).delete(cpmCoinDocRef).commit();
    functions.logger.log(`Deleted main user doc and cpm_coins doc for ${userIdToDelete}`);


    // Step 3: Delete user's files from Cloud Storage
    const bucket = storage.bucket();
    const kycPath = `kyc_documents/${userIdToDelete}/`;
    const depositPath = `deposit_screenshots/${userIdToDelete}/`;
    await Promise.all([
        bucket.deleteFiles({ prefix: kycPath }),
        bucket.deleteFiles({ prefix: depositPath })
    ]);
    functions.logger.log(`Deleted storage files for user ${userIdToDelete}`);


    // Step 4: Delete user from Firebase Authentication
    // We check if the user exists first as requested.
    try {
        await auth.getUser(userIdToDelete); // This will throw 'auth/user-not-found' if user doesn't exist
        await auth.deleteUser(userIdToDelete);
        functions.logger.log(`Successfully deleted auth user: ${userIdToDelete}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            functions.logger.warn(`Auth user ${userIdToDelete} was not found. They may have already been deleted. Proceeding as success.`);
        } else {
            // Re-throw other auth errors
            throw error;
        }
    }
    
    return { success: true, message: `Successfully deleted user ${userIdToDelete} and all associated data.` };

  } catch (error: any) {
    functions.logger.error(`Failed to delete user ${userIdToDelete}:`, error);
    throw new functions.https.HttpsError(
        "internal",
        `An internal error occurred while deleting the user: ${error.message}`
    );
  }
});
