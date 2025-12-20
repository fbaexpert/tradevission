
import { NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import nodemailer from 'nodemailer';

// In Next.js App Router, environment variables from .env.local are loaded automatically on the server.
// The require('dotenv').config() call is not necessary and can be removed.

export async function POST(request: Request) {
    const { uid } = await request.json();

    if (!uid) {
        return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { db } = getFirebase();
    const userRef = doc(db, 'users', uid);

    try {
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }
        
        const userData = userDoc.data();
        if (!userData || !userData.email) {
             return NextResponse.json({ error: 'User data or email is missing.' }, { status: 400 });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

        await updateDoc(userRef, {
            'withdrawalVerification.otp': otp,
            'withdrawalVerification.otpExpiry': Timestamp.fromDate(otpExpiry),
            'withdrawalVerification.status': 'pending_otp',
        });
        
        // Nodemailer transporter setup
        // Ensure EMAIL_USER and EMAIL_PASS are set in your .env.local file
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports (like 587 with STARTTLS)
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Use App Password for Gmail
            },
        });

        // Send email using Nodemailer
        const mailOptions = {
            from: `"TradeVission Security" <${process.env.EMAIL_USER}>`,
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
        };

        await transporter.sendMail(mailOptions);

        return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

    } catch (error: any) {
        // Enhanced error logging to help diagnose the issue.
        console.error(`[OTP_SEND_ERROR] Failed to send OTP for user ${uid}:`, error);
        
        let clientMessage = 'Failed to send OTP. Please try again.';
        if (error.code === 'EAUTH') {
            clientMessage = 'Failed to send email. Please check server email credentials.';
        } else if (error.code === 'ECONNREFUSED') {
             clientMessage = 'Failed to connect to the email server. Please check the host/port settings.';
        }

        return NextResponse.json({ error: clientMessage }, { status: 500 });
    }
}
