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
    
    // Check if email and password are configured
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
