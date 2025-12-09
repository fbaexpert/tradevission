
"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LoaderCircle, User, Mail, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const nameSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters"),
});

const emailSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Current password is required"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  });

export default function ProfilePage() {
  const { user } = useAuth();
  const { auth, db } = useFirebase();
  const { toast } = useToast();
  const [loading, setLoading] = useState({
    name: false,
    email: false,
    password: false,
  });

  const nameForm = useForm<z.infer<typeof nameSchema>>({
    resolver: zodResolver(nameSchema),
    defaultValues: { name: user?.displayName || "" },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: user?.email || "", password: "" },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const reauthenticate = (password: string) => {
    if (!user || !user.email) throw new Error("User not found");
    const credential = EmailAuthProvider.credential(user.email, password);
    return reauthenticateWithCredential(user, credential);
  };

  const onNameSubmit = async (values: z.infer<typeof nameSchema>) => {
    if (!user || !auth || !db) return;
    setLoading((prev) => ({ ...prev, name: true }));
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: values.name });
      }
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { name: values.name });

      toast({
        title: "Success",
        description: "Your name has been updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, name: false }));
    }
  };

  const onEmailSubmit = async (values: z.infer<typeof emailSchema>) => {
    if (!user || !auth || !db) return;
    setLoading((prev) => ({ ...prev, email: true }));
    try {
      await reauthenticate(values.password);

      if (auth.currentUser) {
        await updateEmail(auth.currentUser, values.email);
      }
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { email: values.email });
      emailForm.reset({ email: values.email, password: "" });
      toast({
        title: "Email Updated",
        description:
          "Your email has been changed. Please check your inbox for verification.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error updating email",
        description:
          error.code === "auth/wrong-password"
            ? "Incorrect password."
            : error.message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, email: false }));
    }
  };

  const onPasswordSubmit = async (
    values: z.infer<typeof passwordSchema>
  ) => {
    if (!user || !auth) return;
    setLoading((prev) => ({ ...prev, password: true }));
    try {
      await reauthenticate(values.currentPassword);
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, values.newPassword);
      }
      passwordForm.reset();
      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error changing password",
        description:
          error.code === "auth/wrong-password"
            ? "Incorrect current password."
            : error.message,
      });
    } finally {
      setLoading((prev) => ({ ...prev, password: false }));
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-2xl space-y-8">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex items-center gap-4">
              <User className="h-6 w-6 text-accent" />
              <CardTitle className="text-2xl font-bold text-white">
                Update Profile
              </CardTitle>
            </div>
            <CardDescription>
              Manage your personal information.
            </CardDescription>
          </CardHeader>
          <Form {...nameForm}>
            <form onSubmit={nameForm.handleSubmit(onNameSubmit)}>
              <CardContent>
                <FormField
                  control={nameForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your full name"
                          {...field}
                          disabled={loading.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading.name}>
                  {loading.name && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Name
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Mail className="h-6 w-6 text-accent" />
              <CardTitle className="text-2xl font-bold text-white">
                Change Email
              </CardTitle>
            </div>
             <CardDescription>
              Update the email address associated with your account.
            </CardDescription>
          </CardHeader>
          <Form {...emailForm}>
            <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
               <CardContent className="space-y-4">
                 <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                    <CardDescription>
                        For security, you must provide your current password to change your email address.
                    </CardDescription>
                 </Alert>
                <FormField
                  control={emailForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="new.email@example.com"
                          {...field}
                          disabled={loading.email}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={emailForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={loading.email}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading.email}>
                  {loading.email && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Email
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>

        <Card className="border-border/20 shadow-lg shadow-primary/5">
          <CardHeader>
            <div className="flex items-center gap-4">
              <Lock className="h-6 w-6 text-accent" />
              <CardTitle className="text-2xl font-bold text-white">
                Change Password
              </CardTitle>
            </div>
             <CardDescription>
              Set a new password for your account.
            </CardDescription>
          </CardHeader>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
               <CardContent className="space-y-4">
                 <Alert variant="destructive" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-300">
                    <CardDescription>
                        You must provide your current password to set a new one.
                    </CardDescription>
                 </Alert>
                 <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={loading.password}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={loading.password}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          {...field}
                          disabled={loading.password}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={loading.password}>
                  {loading.password && (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Change Password
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
