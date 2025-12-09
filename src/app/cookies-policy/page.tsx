
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function CookiesPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Cookies Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">What Are Cookies?</h3>
                        <p>Cookies are small text files stored on your device (computer, phone, tablet) when you visit our website. They help our website to function correctly and provide a better user experience.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">How We Use Cookies</h3>
                        <p>We use cookies exclusively for essential functions, including:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                            <li><strong>Session Management:</strong> To keep you logged in securely as you navigate the site.</li>
                            <li><strong>Security:</strong> To protect your account and prevent fraudulent activity.</li>
                            <li><strong>Preferences:</strong> To remember your settings and preferences.</li>
                        </ul>
                        <p className="mt-2">We do not use cookies for tracking, third-party advertising, or sharing your data with external services.</p>
                    </section>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Your Choices</h3>
                        <p>You can manage or disable cookies through your browser settings. However, please be aware that disabling essential cookies will prevent you from being able to log in and use our platform's core features.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
