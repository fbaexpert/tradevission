
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createTransport } from 'nodemailer';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Set Nodemailer config from Firebase environment variables
const nodemailerConfig = functions.config().nodemailer;
const transporter = createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: nodemailerConfig?.user,
        pass: nodemailerConfig?.pass,
    },
});

/**
 * A callable function that sends a 6-digit OTP to the user's email for withdrawal verification.
 */
export const sendWithdrawalOtp = functions.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }
    
    if (!nodemailerConfig?.user || !nodemailerConfig?.pass) {
        functions.logger.error("Nodemailer is not configured. Run 'firebase functions:config:set nodemailer.user=\"EMAIL\" nodemailer.pass=\"PASSWORD\"'");
        throw new functions.https.HttpsError('internal', 'The email service is not configured.');
    }

    const uid = context.auth.uid;
    const userRef = admin.firestore().collection('users').doc(uid);

    try {
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'User not found.');
        }
        
        const userData = userDoc.data();
        if (!userData?.email) {
             throw new functions.https.HttpsError('not-found', 'User email is missing.');
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        await userRef.update({
            'withdrawalVerification.otp': otp,
            'withdrawalVerification.otpExpiry': admin.firestore.Timestamp.fromDate(otpExpiry),
            'withdrawalVerification.status': 'pending_otp',
        });
        
        await transporter.sendMail({
            from: `"TradeVission Security" <${nodemailerConfig.user}>`,
            to: userData.email,
            subject: `Your TradeVission Verification Code: ${otp}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 600px; margin: auto; border-top: 5px solid #1E3A8A;">
                    <h2 style="color: #1E3A8A;">TradeVission Account Verification</h2>
                    <p>Hello ${userData.name || 'User'},</p>
                    <p>Your one-time password (OTP) for withdrawal verification is:</p>
                    <h2 style="font-size: 36px; font-weight: bold; letter-spacing: 4px; color: #1E3A8A; text-align: center; background-color: #f4f4f4; padding: 20px; border-radius: 5px;">${otp}</h2>
                    <p>This code is valid for 10 minutes. If you did not request this code, please secure your account immediately.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                    <p style="font-size: 12px; color: #777;">Thank you,<br/>The TradeVission Team</p>
                </div>
            `,
        });

        return { success: true };
    } catch (error: any) {
        functions.logger.error(`Error sending OTP for user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to send OTP. Please check server logs and email configuration.');
    }
});

/**
 * A callable function that verifies the provided OTP for withdrawal.
 */
export const verifyWithdrawalOtp = functions.runWith({ enforceAppCheck: true }).https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const uid = context.auth.uid;
    const providedOtp = data.otp;

    if (!providedOtp || typeof providedOtp !== 'string' || providedOtp.length !== 6) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid 6-digit OTP must be provided.');
    }

    const userRef = admin.firestore().collection('users').doc(uid);

    try {
        return await admin.firestore().runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'User not found.');
            }

            const verificationData = userDoc.data()?.withdrawalVerification || {};

            if (verificationData.status === 'locked' && verificationData.cooldownUntil && verificationData.cooldownUntil.toDate() > new Date()) {
                throw new functions.https.HttpsError('failed-precondition', 'Account is locked. Please try again later.');
            }

            if (verificationData.otp !== providedOtp) {
                const newAttempts = (verificationData.attempts || 0) + 1;
                if (newAttempts >= 3) {
                    const cooldownUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
                    transaction.update(userRef, {
                        'withdrawalVerification.status': 'locked',
                        'withdrawalVerification.attempts': newAttempts,
                        'withdrawalVerification.cooldownUntil': admin.firestore.Timestamp.fromDate(cooldownUntil),
                    });
                     throw new functions.https.HttpsError('invalid-argument', 'Incorrect OTP. Your account is now locked for 24 hours.');
                } else {
                     transaction.update(userRef, { 'withdrawalVerification.attempts': newAttempts });
                     throw new functions.https.HttpsError('invalid-argument', `Incorrect OTP. You have ${3 - newAttempts} attempts left.`);
                }
            }

            if (!verificationData.otpExpiry || verificationData.otpExpiry.toDate() < new Date()) {
                transaction.update(userRef, {
                    'withdrawalVerification.otp': null,
                    'withdrawalVerification.otpExpiry': null,
                });
                throw new functions.https.HttpsError('deadline-exceeded', 'OTP has expired. Please request a new one.');
            }
            
            // Success
            transaction.update(userRef, {
                'withdrawalVerification.status': 'verified',
                'withdrawalVerification.attempts': 0,
                'withdrawalVerification.otp': null,
                'withdrawalVerification.otpExpiry': null,
                'withdrawalVerification.cooldownUntil': null,
            });

            return { success: true, message: 'Account verified successfully.' };
        });
    } catch (error: any) {
        functions.logger.error(`Error verifying OTP for user ${uid}:`, error.message);
        throw error; // Re-throw the original error to be caught by the client
    }
});


/**
 * A callable function that allows an admin to change a user's password.
 */
export const changeUserPassword = functions.https.onCall(async (data, context) => {
    if (context.auth?.token.email !== 'ummarfarooq38990@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can change user passwords.');
    }

    const { uid, password } = data;
    if (!uid || !password) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with "uid" and "password" arguments.');
    }

    if (password.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    try {
        await admin.auth().updateUser(uid, { password });
        functions.logger.log(`Successfully changed password for user: ${uid}`);
        return { success: true, message: 'Password updated successfully.' };
    } catch (error: any) {
        functions.logger.error(`Error changing password for user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to update password.');
    }
});


/**
 * A callable function that allows an admin to initiate the deletion of a user account.
 * This function ONLY deletes the user from Firebase Authentication.
 * The `deleteUserDataOnAuthDelete` trigger will handle the rest of the cleanup.
 */
export const deleteUserAccount = functions.https.onCall(async (data, context) => {
    if (context.auth?.token.email !== 'ummarfarooq38990@gmail.com') {
        throw new functions.https.HttpsError('permission-denied', 'Only admins can delete user accounts.');
    }

    const uid = data.uid;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a "uid" argument.');
    }

    try {
        await admin.auth().deleteUser(uid);
        functions.logger.log(`Admin initiated deletion for auth user: ${uid}. Cleanup will be handled by onDelete trigger.`);
        return { success: true, message: `Successfully deleted user ${uid}.` };
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            functions.logger.warn(`Auth user ${uid} was not found, but proceeding to trigger manual cleanup for orphaned data.`);
            // Manually trigger cleanup for orphaned Firestore data if auth user is already gone.
            await cleanupFirestoreData(uid);
            return { success: true, message: `Auth user ${uid} not found, but associated data has been cleaned up.` };
        }
        functions.logger.error(`Error during admin deletion of user ${uid}:`, error);
        throw new functions.https.HttpsError('internal', error.message || 'A failure occurred during the account deletion process.');
    }
});

/**
 * Helper function to delete data for a user from Firestore.
 */
async function cleanupFirestoreData(uid: string) {
    const db = admin.firestore();
    const batch = db.batch();
    
    // 1. Delete main user documents
    batch.delete(db.collection('users').doc(uid));
    batch.delete(db.collection('cpm_coins').doc(uid));
    
    // 2. Query and delete all related top-level documents
    const collectionsToDelete = [
        { name: 'userPlans', field: 'userId' },
        { name: 'deposits', field: 'uid' }, // Note: 'uid' field
        { name: 'withdrawals', field: 'userId' },
        { name: 'cpmWithdrawals', field: 'userId' },
        { name: 'supportTickets', field: 'userId' },
        { name: 'feedback', field: 'userId' },
        { name: 'kycSubmissions', field: 'userId' },
        { name: 'cpm_purchase_logs', field: 'userId' },
        { name: 'activityLogs', field: 'userId' },
    ];

    for (const { name, field } of collectionsToDelete) {
        try {
            const snapshot = await db.collection(name).where(field, '==', uid).get();
            if (!snapshot.empty) {
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
            }
        } catch(e) {
            functions.logger.error(`[MANUAL-CLEANUP] Could not query collection ${name} for user ${uid}. Index might be missing.`, e);
        }
    }
    
    // 3. Commit the batched Firestore writes
    try {
        await batch.commit();
        functions.logger.log(`[MANUAL-CLEANUP] Main Firestore documents deleted for user: ${uid}`);
    } catch (e) {
        functions.logger.error(`[MANUAL-CLEANUP] Failed to commit main batch delete for user ${uid}.`, e);
    }
}

/**
 * Triggered when a user is deleted from Firebase Authentication.
 * Cleans up all associated data from Firestore and Storage. This is the main cleanup logic.
 */
export const deleteUserDataOnAuthDelete = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    functions.logger.log(`[AUTO-CLEANUP] Starting full data cleanup for deleted user: ${uid}`);
    const db = admin.firestore();
    const bucket = admin.storage().bucket();

    // 1. Clean up Firestore data
    await cleanupFirestoreData(uid);
    
    // 2. Delete subcollections (requires separate, non-batched operations for reliability)
    const subcollections = ['notifications', 'vipMailbox', 'airdrop_claims'];
    const userRef = db.collection('users').doc(uid); // Path to a doc that no longer exists, but subcollections do
    for (const sub of subcollections) {
        try {
            const subcollectionRef = userRef.collection(sub);
            const subSnapshot = await subcollectionRef.get();
            if (!subSnapshot.empty) {
                const subBatch = db.batch();
                subSnapshot.docs.forEach(doc => subBatch.delete(doc.ref));
                await subBatch.commit();
                functions.logger.log(`[AUTO-CLEANUP] Deleted ${subSnapshot.size} documents from subcollection '${sub}' for user: ${uid}`);
            }
        } catch (e) {
             functions.logger.error(`[AUTO-CLEANUP] Could not clean subcollection ${sub} for user ${uid}.`, e);
        }
    }

    // 3. Delete all files from Firebase Storage
    const storagePaths = [`deposit_screenshots/${uid}`, `kyc_documents/${uid}`];
    for (const path of storagePaths) {
        try {
            await bucket.deleteFiles({ prefix: path, force: true });
            functions.logger.log(`[AUTO-CLEANUP] Storage path '${path}' cleaned for user: ${uid}`);
        } catch(err: any) {
            // It's common to get a 404 here if the folder doesn't exist, which is fine.
            if(err.code !== 404) {
                 functions.logger.error(`[AUTO-CLEANUP] Failed to delete storage path '${path}':`, err);
            }
        }
    }
});


/**
 * A callable function to perform a "hard reset" on a user account.
 * This wipes most of their progress data but does not delete their auth record.
 */
export const hardResetUser = functions.runWith({timeoutSeconds: 120, memory: '512MB'}).https.onCall(async (data, context) => {
    if (context.auth?.token.email !== 'ummarfarooq38990@gmail.com') {
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
        withdrawalVerification: {
            required: false,
            status: 'not_verified',
            attempts: 0,
            cooldownUntil: null,
            otp: null,
            otpExpiry: null
        }
    });

    // 2. Reset CPM coins document
    const cpmCoinRef = db.collection('cpm_coins').doc(uid);
    mainBatch.update(cpmCoinRef, { amount: 0 });

    // Collections to delete documents from
    const collectionsToDelete = [
        { name: 'userPlans', field: 'userId' },
        { name: 'deposits', field: 'uid' }, // Note: 'uid' field
        { name: 'withdrawals', field: 'userId' },
        { name: 'cpmWithdrawals', field: 'userId' },
        { name: 'supportTickets', field: 'userId' },
        { name: 'feedback', field: 'userId' },
        { name: 'kycSubmissions', field: 'userId' },
        { name: 'cpm_purchase_logs', field: 'userId' },
        { name: 'activityLogs', field: 'userId' },
    ];

    try {
        // 3. Delete documents from top-level collections
        for (const { name, field } of collectionsToDelete) {
            const snapshot = await db.collection(name).where(field, '==', uid).get();
            if (!snapshot.empty) {
                snapshot.forEach(doc => mainBatch.delete(doc.ref));
            }
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
