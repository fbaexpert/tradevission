'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useFirebase } from '@/lib/firebase/provider';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { LoaderCircle, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

const passwordSchema = z.object({
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function AuthActionPage() {
    const { auth } = useFirebase();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // State to hold parameters from URL
    const [mode, setMode] = useState<string | null>(null);
    const [actionCode, setActionCode] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [isValidCode, setIsValidCode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const form = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
        defaultValues: { newPassword: "", confirmPassword: "" }
    });

    useEffect(() => {
        const modeParam = searchParams.get('mode');
        const codeParam = searchParams.get('oobCode');

        if (modeParam && codeParam) {
            setMode(modeParam);
            setActionCode(codeParam);
        } else {
            setError("Invalid or incomplete link. Please request a new link.");
            setLoading(false);
        }
    }, [searchParams]);

    useEffect(() => {
        if (mode && actionCode && auth) {
            if (mode === 'resetPassword') {
                verifyPasswordResetCode(auth, actionCode)
                    .then(() => {
                        setIsValidCode(true);
                        setLoading(false);
                    })
                    .catch((err) => {
                        setError("Invalid or expired password reset link. Please request a new one.");
                        setLoading(false);
                    });
            } else {
                setError(`Unsupported action mode: '${mode}'. Please check the link.`);
                setLoading(false);
            }
        }
        // This effect runs when mode, actionCode, or auth becomes available.
    }, [mode, actionCode, auth]);

    const handleResetPassword = async (data: PasswordFormData) => {
        if (!auth || !actionCode) {
            setError("An unexpected error occurred. Please try again.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await confirmPasswordReset(auth, actionCode, data.newPassword);
            setSuccess("Your password has been successfully reset. You can now log in with your new password.");
        } catch (err: any) {
            setError("Failed to reset password. The link may have expired or been used already. Please request a new one.");
        } finally {
            setLoading(false);
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
                </Alert>
            );
        }
        if (success) {
            return (
                <div className="text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-foreground">{success}</p>
                    <Button asChild className="mt-4">
                        <Link href="/login">Go to Login</Link>
                    </Button>
                </div>
            );
        }

        if (isValidCode && mode === 'resetPassword') {
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
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading && <LoaderCircle className="animate-spin mr-2" />}
                        Reset Password
                    </Button>
                </form>
            );
        }

        // Fallback for any other state
        return null;
    };


    return (
        <div className="flex min-h-screen items-center justify-center p-4 bg-background">
            <Card className="w-full max-w-md border-border/20 shadow-lg shadow-primary/5">
                <CardHeader>
                    <CardTitle className="text-2xl text-center text-white">
                        {mode === 'resetPassword' ? 'Reset Your Password' : 'Authentication Action'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {isValidCode && mode === 'resetPassword' && !success && "Enter your new password below."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
}
