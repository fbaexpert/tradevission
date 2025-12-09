
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Footer } from "@/components/shared/footer";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ArrowLeft } from "lucide-react";

export default function EarningsDisclaimerPage() {
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
                    <CardTitle className="text-3xl font-bold text-white">Earnings Disclaimer</CardTitle>
                    <CardDescription>Last Updated: 7 December 2025</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 text-muted-foreground">
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">No Guarantee of Income</h3>
                        <p>TradeVission makes no guarantees regarding the level of success you may experience. Any earnings, revenue, or income statements are estimates of potential earnings only, and should not be considered as typical or guaranteed.</p>
                        <p className="mt-2">Your individual success will depend on your personal effort, the specific investment plan you choose, and external market factors that are beyond our control.</p>
                    </section>
                     <section>
                        <h3 className="font-bold text-white mb-2 text-lg">For Educational & Entertainment Purposes</h3>
                        <p>Our platform is designed for educational and entertainment purposes. The "Points" system and associated rewards are part of a simulated environment. While points can be redeemed according to our withdrawal policy, they do not represent a direct claim on real currency or assets.</p>
                    </section>
                    <section>
                        <h3 className="font-bold text-white mb-2 text-lg">Testimonials and Examples</h3>
                        <p>Testimonials and examples used are exceptional results, do not apply to the average user, and are not intended to represent or guarantee that anyone will achieve the same or similar results.</p>
                    </section>
                </CardContent>
            </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
