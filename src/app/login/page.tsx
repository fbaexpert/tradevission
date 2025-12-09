
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import AuthForm from "@/components/auth/auth-form";
import Loader from "@/components/shared/loader";
import { Logo } from "@/components/shared/logo";
import Link from "next/link";

const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";

export default function LoginPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
       if (user.email?.toLowerCase() === ADMIN_EMAIL) {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router]);

  if (loading || user) {
    return <Loader />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
            <Link href="/" className="flex items-center gap-3 mb-4">
                <Logo className="h-10 w-10" />
                <h1 className="text-4xl font-bold text-foreground font-headline tracking-tighter">
                TradeVission
                </h1>
            </Link>
          <p className="text-muted-foreground text-center">
            The future of trading analysis. Sign in to continue.
          </p>
        </div>
        <AuthForm />
      </div>
    </main>
  );
}
