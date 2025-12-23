
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
    // Check if the request is made by an authenticated admin user.
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
        throw new functions.https.HttpsError('internal', 'Failed to update password. Please check server logs.');
    }
});
