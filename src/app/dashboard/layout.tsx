
"use client";

import { useEffect } from "react";
import Link from 'next/link';
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { getFirebase } from "@/lib/firebase/config";
import { signOut } from "firebase/auth";
import { Button } from "@/components/ui/button";
import Loader from "@/components/shared/loader";
import { LogOut, LayoutGrid, Rocket, ArrowDownToDot, ArrowUpFromDot, User, LifeBuoy, Users2, Coins, Lightbulb, KeyRound, Send, Gift, Star, FlipVertical, ShieldCheck as IdCard } from "lucide-react";
import NotificationCenter from "@/components/shared/notification-center";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { Logo } from "@/components/shared/logo";
import { Footer } from "@/components/shared/footer";

const navItems = [
  { href: "/dashboard", icon: LayoutGrid, label: "Home" },
  { href: "/dashboard/plans", icon: Rocket, label: "Plans" },
  { href: "/dashboard/presale", icon: Coins, label: "CPM Coin" },
  { href: "/dashboard/spin-win", icon: Star, label: "Spin & Win" },
  { href: "/dashboard/flip-win", icon: FlipVertical, label: "Flip & Win" },
  { href: "/dashboard/team", icon: Users2, label: "Team" },
  { href: "/dashboard/deposit", icon: ArrowDownToDot, label: "Deposit" },
  { href: "/dashboard/withdraw", icon: ArrowUpFromDot, label: "Withdraw" },
  { href: "/dashboard/cpm-withdraw", icon: Coins, label: "CPM Withdraw" },
  { href: "/dashboard/transfer", icon: Send, label: "Transfer Funds" },
  { href: "/dashboard/airdrop", icon: Gift, label: "Airdrop" },
  { href: "/dashboard/kyc", icon: IdCard, label: "KYC Verification" },
  { href: "/dashboard/redeem", icon: KeyRound, label: "Redeem Code" },
  { href: "/dashboard/support", icon: LifeBuoy, label: "Support" },
  { href: "/dashboard/feedback", icon: Lightbulb, label: "Feedback" },
  { href: "/dashboard/profile", icon: User, label: "Profile" },
];

function DashboardSidebarContent() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
     <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={item.label}
              onClick={() => setOpenMobile(false)}
            >
              <Link href={item.href} className="relative">
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
  )
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      const { auth } = await getFirebase();
      signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  if (loading || !user) {
    return <Loader />;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
            <Logo className="h-8 w-8" />
            <h1 className="text-xl font-bold text-primary font-headline">
              TradeVission
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <DashboardSidebarContent />
        </SidebarContent>
        <SidebarFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign Out</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to logout?</AlertDialogTitle>
                <AlertDialogDescription>
                  You will be returned to the login page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleSignOut} className="bg-destructive hover:bg-destructive/90">Logout</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SidebarFooter>
      </Sidebar>
      <main className="flex-1 flex flex-col min-h-screen">
        <header className="flex h-16 items-center justify-between border-b border-border/20 bg-background/50 backdrop-blur-sm px-4 md:justify-end sticky top-0 z-40">
           <div className="flex items-center gap-4 md:hidden">
              <SidebarTrigger />
               <div className="flex items-center gap-2">
                 <Logo className="h-7 w-7" />
                 <h1 className="text-lg font-bold text-primary font-headline">
                    TradeVission
                 </h1>
              </div>
            </div>
          <div className="flex items-center gap-4">
              <NotificationCenter />
          </div>
        </header>
        <div className="bg-background flex-grow">{children}</div>
      </main>
    </SidebarProvider>
  );
}
