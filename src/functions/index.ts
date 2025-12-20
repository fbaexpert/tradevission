
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
    if (context.auth?.token.isAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete user accounts.');
    }

    const uid = data.uid;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "uid" argument.');
    }

    try {
        await admin.auth().deleteUser(uid);
        functions.logger.log(`Successfully deleted auth user: ${uid}`);
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          functions.logger.warn(`Auth user ${uid} not found, but proceeding with DB cleanup.`);
        } else {
          functions.logger.error(`Error deleting auth user ${uid}:`, error);
          throw new functions.https.HttpsError('internal', 'Failed to delete user from authentication service.');
        }
    }

    try {
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


/**
 * A callable function to perform a "hard reset" on a user account.
 * This wipes most of their progress data but does not delete their auth record.
 */
export const hardResetUser = functions.runWith({timeoutSeconds: 120, memory: '512MB'}).https.onCall(async (data, context) => {
    if (context.auth?.token.isAdmin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can reset user accounts.');
    }

    const uid = data.uid;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "uid" argument.');
    }

    const db = admin.firestore();
    const mainBatch = db.batch();

    // 1. Reset main user document fields
    const userRef = db.collection('users').doc(uid);
    mainBatch.update(userRef, {
        balance0: 0,
        totalDeposit: 0,
        totalWithdrawn: 0,
        totalReferralBonus: 0,
        totalTeamBonus: 0,
        totalTeamDeposit: 0,
        depositDone: false,
        isCommander: false,
        teamBonusPaused: false,
        awardedSuperBonuses: [],
        customBadges: [],
        lastSpinTimestamp: null,
        lastWeeklyRewardPaidAt: null,
    });

    // 2. Reset CPM coins document
    const cpmCoinRef = db.collection('cpm_coins').doc(uid);
    mainBatch.update(cpmCoinRef, { amount: 0 });

    // Collections to delete documents from
    const collectionsToDelete = [
        'userPlans',
        'deposits',
        'withdrawals',
        'cpmWithdrawals',
        'supportTickets',
        'feedback',
        'kycSubmissions',
        'cpm_purchase_logs',
        'activityLogs',
    ];

    try {
        // 3. Delete documents from top-level collections
        for (const collectionName of collectionsToDelete) {
            const snapshot = await db.collection(collectionName).where('userId', '==', uid).get();
            if (!snapshot.empty) {
                snapshot.forEach(doc => mainBatch.delete(doc.ref));
            }
        }
        
         // Also handle deposits collection which uses 'uid' field
        const depositSnapshot = await db.collection('deposits').where('uid', '==', uid).get();
        if(!depositSnapshot.empty) {
            depositSnapshot.forEach(doc => mainBatch.delete(doc.ref));
        }

        // 4. Commit main batch changes
        await mainBatch.commit();
        functions.logger.log(`Main data reset for user ${uid}`);

        // 5. Delete subcollections (requires separate operations)
        const subcollections = ['notifications', 'vipMailbox', 'airdrop_claims'];
        for (const sub of subcollections) {
            const subcollectionRef = userRef.collection(sub);
            const snapshot = await subcollectionRef.get();
            if(!snapshot.empty) {
                const deleteBatch = db.batch();
                snapshot.docs.forEach(doc => deleteBatch.delete(doc.ref));
                await deleteBatch.commit();
            }
        }
        
        functions.logger.log(`Subcollections deleted for user ${uid}`);

        return { success: true, message: `User ${uid} has been successfully reset.` };
    } catch (error: any) {
        functions.logger.error(`Error during hard reset for user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'An error occurred during the reset process.');
    }
});
