
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function RefundPolicyPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Refund Policy</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Refund Eligibility</h3>
                        <p>Refunds are only possible when: A user makes payment by mistake, Service is not delivered within given time, or a Duplicate payment is made.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Non-Refundable</h3>
                        <p>No refund will be given if: User provides wrong details, Fraud is detected, or a User violates platform rules.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Refund Process</h3>
                        <p>Provide TID + screenshot. Admin will review. Refund can take 24–72 hours.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
