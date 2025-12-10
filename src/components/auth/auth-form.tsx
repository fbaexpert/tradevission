
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useFirebase } from "@/lib/firebase/provider";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc, updateDoc, increment, collection, writeBatch, query, where, getDocs, runTransaction } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, LogIn, UserPlus, LoaderCircle, Users, Mail, Phone } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "./terms-dialog";
import { useToast } from "@/hooks/use-toast";

const signUpSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phone: z.string().min(10, { message: "Please enter a valid phone number." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter." })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter." })
    .regex(/\d/, { message: "Password must contain at least one digit." })
    .regex(/[@$!%*?&]/, { message: "Password must contain at least one special character." }),
  terms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions.",
  }),
});

const loginSchema = z.object({
  identifier: z.string().min(1, { message: "Email or Phone Number is required." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const resetPasswordSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email to send a reset link to." }),
});

const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";

interface SuperBonusTier {
    referrals: number;
    bonus: number;
}

interface CommanderSettings {
    referralRequirement: number;
}

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth, db } = useFirebase();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [referralId, setReferralId] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Prioritize URL parameter
    const refIdFromUrl = searchParams.get('ref');
    if (refIdFromUrl) {
      setReferralId(refIdFromUrl);
      localStorage.setItem('referralId', refIdFromUrl); // Sync localStorage
      return;
    }

    // Fallback to localStorage
    const refIdFromStorage = localStorage.getItem('referralId');
    if (refIdFromStorage) {
      setReferralId(refIdFromStorage);
    }
  }, [searchParams]);

  useEffect(() => {
    if (referralId && db) {
      const referrerDocRef = doc(db, "users", referralId);
      getDoc(referrerDocRef).then(docSnap => {
        if (docSnap.exists()) {
          setReferrerName(docSnap.data().name);
        } else {
          // If referrer ID is invalid, clear it
          localStorage.removeItem('referralId');
          setReferralId(null);
          setReferrerName(null);
        }
      }).catch(() => {
        localStorage.removeItem('referralId');
        setReferralId(null);
        setReferrerName(null);
      });
    }
  }, [referralId, db]);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const signUpForm = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", terms: false },
  });
  
  const resetPasswordForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    setError(null);
    if (!auth || !db) return;

    try {
      let emailToLogin = values.identifier;

      if (!values.identifier.includes('@')) {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("phone", "==", values.identifier));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          throw new Error("No account found with this phone number.");
        }
        
        const userDoc = querySnapshot.docs[0];
        emailToLogin = userDoc.data().email;
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, emailToLogin, values.password);
      const user = userCredential.user;
      
      if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }

    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid credentials. Please check your details and try again.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
        setLoading(false);
    }
  };

  const handleSignUp = async (values: z.infer<typeof signUpSchema>) => {
    setLoading(true);
    setError(null);
    if (!auth || !db) return;
    
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        values.email,
        values.password
      );
      const user = userCredential.user;

      await updateProfile(user, { displayName: values.name });
      
      await runTransaction(db, async (transaction) => {
        const finalReferralId = referralId;
        
        let ipAddress = 'N/A';
        let deviceInfo = 'N/A';
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            ipAddress = data.ip;
            deviceInfo = navigator.userAgent;
        } catch (e) {
            console.error("Could not fetch IP/device info:", e);
        }

        const newUserRef = doc(db, "users", user.uid);
        const userData: any = {
            name: values.name,
            email: values.email,
            phone: values.phone,
            createdAt: serverTimestamp(),
            balance: 0,
            balance0: 0,
            totalWithdrawn: 0,
            withdrawalStatus: 'enabled',
            termsAccepted: true,
            acceptedAt: serverTimestamp(),
            depositDone: false,
            totalReferralBonus: 0,
            totalTeamBonus: 0,
            totalTeamDeposit: 0,
            totalTeamMembers: 0,
            awardedSuperBonuses: [],
            isCommander: false,
            ipAddress: ipAddress,
            deviceInfo: deviceInfo,
        };
        
        if (finalReferralId) {
            userData.referredBy = finalReferralId;
        }
        transaction.set(newUserRef, userData);

        if (finalReferralId) {
            const referrerRef = doc(db, "users", finalReferralId);
            const referrerDoc = await transaction.get(referrerRef);
            if (!referrerDoc.exists()) {
                throw new Error("Invalid referral code. Please check the link and try again.");
            }

            transaction.update(referrerRef, {
                totalTeamMembers: increment(1)
            });

            const referrerData = referrerDoc.data();
            const newTeamCount = (referrerData?.totalTeamMembers || 0) + 1;
          
            const settingsDocRef = doc(db, "system", "settings");
            const settingsDoc = await getDoc(settingsDocRef);
          
            if (settingsDoc.exists()) {
                const settingsData = settingsDoc.data();
                const commanderSettings: CommanderSettings | undefined = settingsData.commander;
                if (commanderSettings && !referrerData?.isCommander && newTeamCount >= commanderSettings.referralRequirement) {
                    transaction.update(referrerRef, { isCommander: true });
                }

                const bonusTiers: SuperBonusTier[] = settingsData.superBonusTiers || [];
                const awardedBonuses: number[] = referrerData?.awardedSuperBonuses || [];

                for (const tier of bonusTiers) {
                    if (newTeamCount >= tier.referrals && !awardedBonuses.includes(tier.referrals)) {
                        transaction.update(referrerRef, {
                            balance0: increment(tier.bonus),
                            awardedSuperBonuses: [...awardedBonuses, tier.referrals]
                        });
                    }
                }
            }
        }
      });
      
      if (referralId) {
        const batch = writeBatch(db);
        const referrerRef = doc(db, "users", referralId);
        const referrerDoc = await getDoc(referrerRef);
        const referrerData = referrerDoc.data();
        const newTeamCount = (referrerData?.totalTeamMembers || 0);

        const settingsDocRef = doc(db, "system", "settings");
        const settingsDoc = await getDoc(settingsDocRef);
        if (settingsDoc.exists()) {
          const settingsData = settingsDoc.data();
          const commanderSettings: CommanderSettings | undefined = settingsData.commander;
          if (commanderSettings && referrerData?.isCommander && newTeamCount === commanderSettings.referralRequirement) {
             const notifRef = doc(collection(db, "users", referralId, "notifications"));
             batch.set(notifRef, {
                userId: referralId, type: 'success', title: '🏆 Rank Promotion: Commander!',
                message: `Congratulations! You've been promoted to Commander for reaching ${commanderSettings.referralRequirement} team members.`,
                status: 'unread', seen: false, createdAt: serverTimestamp(),
             });
          }
          const bonusTiers: SuperBonusTier[] = settingsData.superBonusTiers || [];
          for (const tier of bonusTiers) {
            if (newTeamCount === tier.referrals) {
              const notifRef = doc(collection(db, "users", referralId, "notifications"));
              batch.set(notifRef, {
                  userId: referralId, type: 'success', title: '🏆 Super Bonus Unlocked!',
                  message: `Congratulations! You reached ${tier.referrals} referrals and earned a $${tier.bonus} bonus!`,
                  amount: tier.bonus, status: 'unread', seen: false, createdAt: serverTimestamp(),
              });
            }
          }
        }
        await batch.commit();
      }

      localStorage.removeItem('referralId');
      router.push("/dashboard");

    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("An account with this email already exists. Please log in instead.");
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    } finally {
        setLoading(false);
    }
  };

  const handlePasswordReset = async (values: z.infer<typeof resetPasswordSchema>) => {
    setResetLoading(true);
    setResetError(null);
    if (!auth) return;
    try {
        await sendPasswordResetEmail(auth, values.email);
        toast({
            title: "Password Reset Email Sent",
            description: "Please check your inbox (and spam folder) for a link to reset your password.",
        });
        setIsResetDialogOpen(false);
        resetPasswordForm.reset();
    } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
            setResetError("No user found with this email address.");
        } else {
            setResetError("An error occurred. Please try again.");
        }
    } finally {
        setResetLoading(false);
    }
  }
  
  const isLoading = loading;
  const termsAccepted = signUpForm.watch("terms");

  return (
    <>
    <Card className="bg-card/80 backdrop-blur-sm border-border/20">
      <CardContent className="p-4 sm:p-6">
        {referrerName && (
             <div className="p-3 mb-4 rounded-md bg-primary/10 border border-primary/20 text-center">
                 <p className="text-sm text-primary">
                    🎉 You were invited by: <strong>{referrerName}</strong>
                 </p>
                 <p className="text-xs text-primary/80">Sign up to join their team!</p>
            </div>
        )}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Form {...loginForm}>
              <form
                onSubmit={loginForm.handleSubmit(handleLogin)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={loginForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email or Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com or +1..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                    <Button type="button" variant="link" className="p-0 h-auto text-sm" onClick={() => setIsResetDialogOpen(true)}>
                        Forgot Password?
                    </Button>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && activeTab === 'login' ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <LogIn />
                  )}
                  <span>Login</span>
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="signup">
            <Form {...signUpForm}>
              <form
                onSubmit={signUpForm.handleSubmit(handleSignUp)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={signUpForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 123 456 7890" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signUpForm.control}
                  name="terms"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-transparent p-1 data-[state=unchecked]:border-destructive">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="text-sm font-normal">
                          I confirm that I have read and agree to TradeVission's <TermsDialog />
                        </FormLabel>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading || !termsAccepted}>
                  {isLoading && activeTab === 'signup' ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <UserPlus />
                  )}
                  <span>Create Account</span>
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
        {error && (
            <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
    
    <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reset Your Password</DialogTitle>
                <DialogDescription>
                    Enter your email address below and we'll send you a link to reset your password.
                </DialogDescription>
            </DialogHeader>
             <Form {...resetPasswordForm}>
              <form
                onSubmit={resetPasswordForm.handleSubmit(handlePasswordReset)}
                className="space-y-4 pt-4"
              >
                <FormField
                  control={resetPasswordForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} disabled={resetLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 {resetError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{resetError}</AlertDescription>
                    </Alert>
                )}
                 <DialogFooter>
                    <Button type="submit" className="w-full" disabled={resetLoading}>
                    {resetLoading ? (
                        <LoaderCircle className="animate-spin" />
                    ) : (
                        <Mail />
                    )}
                    <span>Send Reset Link</span>
                    </Button>
                 </DialogFooter>
              </form>
            </Form>
        </DialogContent>
    </Dialog>

    </>
  );
}
