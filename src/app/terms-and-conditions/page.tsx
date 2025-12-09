
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function TermsAndConditionsPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Terms & Conditions</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <p>By using TradeVission, you agree to follow all terms mentioned below.</p>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">User Responsibilities</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>Provide accurate information</li>
                            <li>Do not use fake screenshots, fake TIDs, or fraudulent activity</li>
                            <li>Do not misuse rewards or referral system</li>
                            <li>Follow all platform rules</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Payments</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>All payments require manual verification</li>
                            <li>Admin has full authority to approve or reject fake/unverified payments</li>
                            <li>Processing time may vary</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Account Actions</h3>
                        <p>Admin can: Block or delete accounts involved in fraud, Edit balances, Modify services, and Send notifications.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Changes to Terms</h3>
                        <p>We may update these terms anytime. Users will be notified if major changes occur.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
