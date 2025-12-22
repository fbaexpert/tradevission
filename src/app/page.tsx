
'use client';

import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart, DollarSign, Rocket, UserPlus } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { useEffect, useState } from "react";
import { useSearchParams } from 'next/navigation';
import Loader from "@/components/shared/loader";

const FeatureCard = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
  <div className="relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-card to-muted/20 p-6 shadow-lg transition-all duration-300 hover:shadow-primary/20 hover:-translate-y-1 group">
     <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
     <div className="relative z-10 p-0 mb-4 text-center">
      <div className="inline-block bg-primary/10 p-3 rounded-full border border-primary/20 transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/20">
        <Icon className="h-8 w-8 text-primary" />
      </div>
    </div>
    <div className="relative z-10 p-0 text-center">
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  </div>
);

export default function LandingPage() {
  const [loginHref, setLoginHref] = useState("/login");
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    // --- PASSWORD RESET REDIRECT ---
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');

    if (mode === 'resetPassword' && oobCode) {
      // Use window.location.replace for a hard, immediate redirect that doesn't push to history.
      window.location.replace(`/reset-password?mode=${mode}&oobCode=${oobCode}`);
      return; // Stop further execution
    }

    // --- REFERRAL CODE LOGIC ---
    const refId = searchParams.get('ref');
    if (refId) {
        localStorage.setItem('tradevission_ref', refId);
        setLoginHref(`/login?ref=${refId}`);
    } else {
        const storedRefId = localStorage.getItem('tradevission_ref');
        if (storedRefId) {
            setLoginHref(`/login?ref=${storedRefId}`);
        }
    }

    // If we reach here, it means we are not redirecting.
    setIsCheckingRedirect(false);

  }, [searchParams]);

  // While checking, show a loader to prevent the landing page from flashing.
  if (isCheckingRedirect) {
    return <Loader />;
  }

  // --- NORMAL LANDING PAGE CONTENT ---
  return (
      <div className="bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="py-4 px-6 md:px-12 flex justify-between items-center border-b border-border/20 backdrop-blur-sm sticky top-0 z-50 bg-background/50">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-2xl font-bold text-white font-headline tracking-tighter">
            TradeVission
          </h1>
        </div>
        <nav>
          <Button asChild>
            <Link href={loginHref}>Sign In</Link>
          </Button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative text-center py-20 md:py-32 px-6 overflow-hidden">
           <div className="absolute inset-0 bg-grid-pattern opacity-10" />
           <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background" />
           <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tighter font-headline">
              Unlock Your Financial Potential
            </h2>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              TradeVission offers a modern platform to help you navigate the markets, invest in your future, and earn daily rewards.
            </p>
            <Button asChild size="lg" className="mt-10 shadow-lg shadow-primary/20">
              <Link href={loginHref}>
                Get Started Now <ArrowRight className="ml-2" />
              </Link>
            </Button>
          </div>
           <style jsx>{`
            .bg-grid-pattern {
                background-image: 
                    linear-gradient(to right, hsl(var(--primary) / 0.1) 1px, transparent 1px),
                    linear-gradient(to bottom, hsl(var(--primary) / 0.1) 1px, transparent 1px);
                background-size: 3rem 3rem;
                animation: pan 60s linear infinite;
            }
            @keyframes pan {
                from { background-position: 0 0; }
                to { background-position: 3rem 3rem; }
            }
           `}</style>
        </section>

        {/* About Section */}
        <section id="about" className="py-20 px-6 bg-muted/30">
          <div className="container mx-auto max-w-5xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What is TradeVission?</h2>
            <p className="text-muted-foreground md:text-lg max-w-3xl mx-auto">
              TradeVission is a simplified investment platform designed to make earning accessible to everyone. We provide structured investment plans that offer daily profits. By completing simple daily tasks, like watching an ad, you unlock your daily earnings. Grow your team by referring others to earn even more rewards and bonuses.
            </p>
          </div>
        </section>
        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 md:py-32 px-6">
            <div className="container mx-auto max-w-6xl">
                 <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-16">
                    Start Earning in 4 Simple Steps
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                   <FeatureCard 
                        icon={UserPlus} 
                        title="1. Register" 
                        description="Create your free account in seconds to get started." 
                    />
                     <FeatureCard 
                        icon={DollarSign} 
                        title="2. Make a Deposit" 
                        description="Add funds to your account balance using our secure deposit methods." 
                    />
                     <FeatureCard 
                        icon={Rocket} 
                        title="3. Choose a Plan" 
                        description="Select an investment plan that fits your goals from our available options." 
                    />
                    <FeatureCard 
                        icon={BarChart} 
                        title="4. Earn Daily" 
                        description="Complete simple daily tasks to earn your profit and watch your investment grow." 
                    />
                </div>
            </div>
        </section>
      </main>
    </div>
  );
}
