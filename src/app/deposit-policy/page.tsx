
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function DepositPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Deposit Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Verification Process</h3>
                        <p>To ensure the security of all transactions, every deposit is manually verified by our team. This process is mandatory for crediting your account with Points.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Required Information</h3>
                        <p>For a successful deposit, you must provide:</p>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                            <li>The correct amount you have sent.</li>
                            <li>The valid Transaction ID (TID) or Hash from your payment provider.</li>
                            <li>A clear, unaltered screenshot of the payment confirmation.</li>
                        </ul>
                        <p className="mt-2">Failure to provide accurate information will result in delays or rejection of your deposit.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Processing Time</h3>
                        <p>Deposits are typically processed within 5 to 30 minutes after you submit the confirmation form. However, delays may occur during periods of high volume or if additional verification is required.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Non-Refundable</h3>
                        <p>Once a deposit is approved and the corresponding Points have been credited to your account, the transaction is considered final and is non-refundable.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
