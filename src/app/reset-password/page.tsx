"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase } from '@/lib/firebase/provider';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LoaderCircle, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/shared/logo';

const passwordSchema = z.object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

function ResetPasswordComponent() {
    const { auth } = useFirebase();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [actionCode, setActionCode] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [isValidCode, setIsValidCode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: "", confirmPassword: "" }
    });

    useEffect(() => {
        const codeParam = searchParams.get('oobCode');

        if (codeParam) {
            setActionCode(codeParam);
        } else {
            setError("Invalid or incomplete password reset link. Please request a new one from the login page.");
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        if (actionCode && auth) {
            verifyPasswordResetCode(auth, actionCode)
                .then(() => {
                    setIsValidCode(true);
                    setLoading(false);
                })
                .catch(() => {
                    setError("Invalid or expired password reset link. Please request a new one.");
                    setLoading(false);
                });
        }
    }, [actionCode, auth]);

    const handleResetPassword = async (data: PasswordFormData) => {
        if (!auth || !actionCode) {
            setError("An unexpected error occurred. Please try again.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await confirmPasswordReset(auth, actionCode, data.newPassword);
            setSuccess("Your password has been successfully reset. You can now log in with your new password.");
        } catch (err: any) {
            setError("Failed to reset password. The link may have expired or been used already. Please request a new one.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderContent = () => {
        if (loading) {
            return <div className="flex justify-center items-center h-48"><LoaderCircle className="animate-spin" /></div>;
        }
        if (error) {
            return (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                     <Button asChild className="mt-4 w-full">
                        <Link href="/login">Back to Login</Link>
                    </Button>
                </Alert>
            );
        }
        if (success) {
            return (
                <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-foreground">{success}</p>
                    <Button asChild className="mt-4 w-full">
                        <Link href="/login">Go to Login</Link>
                    </Button>
                </div>
            );
        }

        if (isValidCode) {
            return (
                <form onSubmit={form.handleSubmit(handleResetPassword)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <Input id="newPassword" type="password" {...form.register('newPassword')} />
                        {form.formState.errors.newPassword && <p className="text-red-500 text-sm">{form.formState.errors.newPassword.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm New Password</Label>
                        <Input id="confirmPassword" type="password" {...form.register('confirmPassword')} />
                        {form.formState.errors.confirmPassword && <p className="text-red-500 text-sm">{form.formState.errors.confirmPassword.message}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting && <LoaderCircle className="animate-spin mr-2" />}
                        Reset Password
                    </Button>
                </form>
            );
        }

        return null;
    };


    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-border/20 shadow-lg shadow-primary/5">
                <CardHeader>
                     <Link href="/" className="flex items-center gap-3 mb-4 justify-center">
                        <Logo className="h-8 w-8" />
                        <h1 className="text-3xl font-bold text-foreground font-headline tracking-tighter">
                        TradeVission
                        </h1>
                    </Link>
                    <CardTitle className="text-2xl text-center text-white">
                        Reset Your Password
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isValidCode && !success && "Enter your new password below."}
                         {!isValidCode && !loading && !error && "Verifying your link..."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-6"><LoaderCircle className="animate-spin h-12 w-12 text-primary" /></div>}>
            <ResetPasswordComponent />
        </Suspense>
    );
}
