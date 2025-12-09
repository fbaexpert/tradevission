
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function KycPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">KYC Verification Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                     <p>To ensure the security of our platform and comply with financial regulations, TradeVission requires users to complete a Know Your Customer (KYC) verification process.</p>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Why We Require KYC</h3>
                         <ul className="list-disc list-inside space-y-1">
                            <li>To prevent fraud, money laundering, and other illicit activities.</li>
                            <li>To verify your identity and protect your account from unauthorized access.</li>
                            <li>To unlock full platform features, including withdrawals.</li>
                         </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Information We Collect</h3>
                         <ul className="list-disc list-inside space-y-1">
                            <li>Your full legal name.</li>
                            <li>A government-issued identification document (e.g., National ID, Passport, Driver's License).</li>
                            <li>A live photo (selfie) of you holding your identification document.</li>
                         </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">How Your Information is Used and Stored</h3>
                         <ul className="list-disc list-inside space-y-1">
                            <li>Your documents are used for identity verification purposes only.</li>
                            <li>All submitted documents are stored securely using industry-standard encryption.</li>
                            <li>Access to your sensitive information is strictly limited to authorized personnel on our compliance team.</li>
                         </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">The Verification Process</h3>
                         <ul className="list-disc list-inside space-y-1">
                            <li>Submissions are reviewed manually by our team.</li>
                            <li>The process typically takes 24-48 hours.</li>
                            <li>You will be notified via email and on the platform once your status is updated (Approved or Rejected).</li>
                            <li>If your submission is rejected, a reason will be provided, and you will be able to resubmit with the correct information.</li>
                         </ul>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
