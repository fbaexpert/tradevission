import { NextResponse } from 'next/server';
import { getFirebase } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import nodemailer from 'nodemailer';

require('dotenv').config();

// IMPORTANT: Initialize Firebase Admin SDK for server-side operations if needed elsewhere,
// but for client-called API routes, we'll use the regular SDK and check authentication.

export async function POST(request: Request) {
    // This is a simplified auth check. In a real app, you'd use a library 
    // like next-auth or verify the ID token from the request headers.
    // For this example, we'll rely on the client sending the UID.
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
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // use true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS, // Use App Password for Gmail
            },
        });

        // Send email using Nodemailer
        await transporter.sendMail({
            from: `"TradeVission Security" <${process.env.EMAIL_USER}>`,
            to: userData.email,
            subject: `Your TradeVission Verification Code: ${otp}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 10px; max-width: 600px; margin: auto;">
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

        return NextResponse.json({ success: true, message: 'OTP sent successfully.' });

    } catch (error: any) {
        console.error(`Error sending OTP for user ${uid}:`, error);
        return NextResponse.json({ error: 'Failed to send OTP. Please try again.' }, { status: 500 });
    }
}
