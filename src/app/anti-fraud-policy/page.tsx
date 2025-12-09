
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function AntiFraudPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Anti-Fraud Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <p>TradeVission maintains a strict, zero-tolerance policy towards any fraudulent activity. Protecting the integrity of our platform and the security of our users is our highest priority.</p>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Prohibited Activities</h3>
                        <p>The following activities are strictly prohibited and will result in immediate account action:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                            <li>Using fake or stolen payment information for deposits.</li>
                            <li>Submitting falsified or manipulated screenshots or Transaction IDs (TID).</li>
                            <li>Creating multiple accounts to misuse the referral or bonus systems (self-referral).</li>
                            <li>Using bots, scripts, or any automated means to interact with the platform or complete tasks.</li>
                            <li>Initiating fraudulent chargebacks or payment disputes.</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Consequences of Fraudulent Activity</h3>
                        <p>Any account found to be engaging in prohibited activities will be subject to immediate and permanent termination without notice. All associated balances, points, and rewards will be forfeited.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Verification and Monitoring</h3>
                        <p>We employ both manual and automated systems to monitor for suspicious activity. All deposits and withdrawals are subject to verification. We reserve the right to request additional information from any user to verify their identity and the legitimacy of their transactions.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
