
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function RiskWarningPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Risk Warning Statement</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <section className="p-4 border-l-4 border-destructive bg-destructive/10">
                        <p className="font-bold text-red-400">All financial activities, including those on this platform, involve a significant level of risk. You should be aware that you may lose part or all of the funds you deposit.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Not Financial Advice</h3>
                        <p>The information and services provided on TradeVission are for educational and entertainment purposes only. We do not provide financial, investment, or legal advice. You should not construe any such information as a recommendation to make any specific investment.</p>
                    </section>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Personal Responsibility</h3>
                        <p>You are solely responsible for your own financial decisions and the outcomes of those decisions. We strongly recommend that you consult with a qualified financial advisor before participating in any activities on this platform.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">No Guarantees</h3>
                        <p>Past performance is not an indicator of future results. There is no guarantee that you will earn any Points or rewards. All platform activities depend on system availability and user participation.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
