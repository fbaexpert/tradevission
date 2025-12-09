
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function WithdrawalPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Withdrawal Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Verification and Processing</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>All withdrawal requests are processed manually to ensure accuracy and security.</li>
                            <li>Processing can take between 5 minutes and 24 hours, depending on network conditions and the volume of requests.</li>
                            <li>Withdrawal requests are only processed during official working hours and days, as stated on the withdrawal page.</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Conditions and Limits</h3>
                        <ul className="list-disc list-inside space-y-1">
                            <li>You may only have one pending withdrawal request at any given time.</li>
                            <li>Minimum and maximum withdrawal limits are in effect and are clearly stated on the withdrawal page.</li>
                            <li>You must have an active investment plan to be eligible for withdrawals.</li>
                            <li>Successful KYC verification is required to enable the withdrawal feature.</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">User Responsibility</h3>
                        <p>It is your sole responsibility to provide the correct wallet address or payment details. TradeVission is not liable for any losses incurred due to incorrect information provided by the user. Transactions sent to wrong addresses are irreversible.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Right to Hold Funds</h3>
                        <p>We reserve the right to temporarily hold any withdrawal request that is deemed suspicious or high-risk for further investigation to prevent fraudulent activity.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
