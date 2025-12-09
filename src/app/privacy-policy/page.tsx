
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background text-foreground min-h-screen flex flex-col">
       <header className="py-4 px-6 md:px-12 flex justify-between items-center border-b border-border/20 backdrop-blur-sm sticky top-0 z-50 bg-background/50">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
            TradeVission
          </h1>
        </div>
        <nav>
          <Button asChild variant="outline">
            <Link href="/"><ArrowLeft className="mr-2"/> Back to Home</Link>
          </Button>
        </nav>
      </header>
      <main className="flex-grow p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl">
            <Card className="border-border/20 shadow-lg shadow-primary/5">
                <CardHeader>
                    <CardTitle className="text-3xl font-bold text-white">Privacy Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                   <p>Welcome to TradeVission. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect your data.</p>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Information We Collect</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Basic account information (name, email, phone number – provided by you)</li>
                            <li>Login details</li>
                            <li>Device information (browser type, IP address)</li>
                            <li>Activity logs (usage history, actions inside the website)</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">How We Use Your Information</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>To create and manage your account</li>
                            <li>To improve website performance</li>
                            <li>To provide services, rewards, and payment updates</li>
                            <li>To prevent fraud or unauthorized activity</li>
                            <li>To show ads (if enabled)</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Data Protection</h3>
                        <p>We do not sell or share your personal data with any third party except trusted partners needed for: Security, Analytics, and Payment verification.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">User Rights</h3>
                        <p>You can request to: Update your information, Delete your account, or Ask what information we store.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Cookies</h3>
                        <p>We use cookies for: Login security, Session management, and a Better user experience.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
