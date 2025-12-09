
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function AffiliateTermsPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Affiliate Program Terms</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <p>This policy governs the use of the TradeVission referral (affiliate) program. By sharing your referral link, you agree to these terms.</p>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Earning Commissions</h3>
                        <p>You can earn commissions from the activities of users you directly refer to the platform. The current commission structure is as follows:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                            <li><strong>First Deposit Bonus:</strong> You receive a 15% bonus based on the amount of your referral's first successful deposit.</li>
                            <li><strong>Daily Team Bonus:</strong> You receive a 10% bonus based on the daily earnings your referral claims from their active investment plan.</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Prohibited Activities</h3>
                        <p>To ensure a fair and legitimate program, the following promotional methods are strictly prohibited:</p>
                         <ul className="list-disc list-inside space-y-1 mt-2">
                            <li><strong>Spam:</strong> Sending unsolicited emails or messages containing your referral link.</li>
                            <li><strong>Misleading Claims:</strong> Making false or exaggerated claims about potential earnings.</li>
                            <li><strong>Self-Referrals:</strong> Creating accounts using your own referral link to gain a commission.</li>
                            <li><strong>Paid Ads:</strong> Using paid advertising (e.g., Google Ads, Facebook Ads) that impersonates the official TradeVission brand.</li>
                        </ul>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Consequences of Violation</h3>
                        <p>Any user found to be violating these terms will have their affiliate privileges revoked. The admin team reserves the right to forfeit any commissions earned through prohibited activities and may terminate the user's account in severe cases.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
