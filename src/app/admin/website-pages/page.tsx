"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { signOut } from "firebase/auth";
import Link from "next/link";
import Loader from "@/components/shared/loader";
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
import {
  Users,
  ArrowDownToDot,
  ArrowUpFromDot,
  LogOut,
  Settings,
  Rocket,
  Package,
  LifeBuoy,
  Wrench,
  Bell,
  FileClock,
  Lightbulb,
  Gift,
  Coins,
  Star,
  KeyRound,
  FlipVertical,
  ShieldCheck,
  Trophy,
  Scale,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import AdminNotificationCenter from "@/components/shared/admin-notification-center";
import { useFirebase } from "@/lib/firebase/provider";
import { Logo } from "@/components/shared/logo";
import { Footer } from "@/components/shared/footer";


const ADMIN_EMAIL = "ummarfarooq38990@gmail.com";

const navItems = [
  { href: "/admin", icon: Users, label: "Users" },
  { href: "/admin/kyc", icon: ShieldCheck, label: "KYC Submissions" },
  { href: "/admin/vip-tiers", icon: Trophy, label: "VIP Tiers" },
  { href: "/admin/commander-rewards", icon: Star, label: "Commander Rewards" },
  { href: "/admin/plans", icon: Package, label: "Manage Plans" },
  { href: "/admin/spin-win", icon: Star, label: "Spin & Win Settings" },
  { href: "/admin/flip-win", icon: FlipVertical, label: "Flip & Win Settings" },
  { href: "/admin/user-plans", icon: Rocket, label: "User Plans" },
  { href: "/admin/deposits", icon: ArrowDownToDot, label: "Deposits" },
  { href: "/admin/withdrawals", icon: ArrowUpFromDot, label: "Withdrawals" },
  { href: "/admin/cpm-withdrawals", icon: Coins, label: "CPM Withdrawals" },
  { href: "/admin/cpm-settings", icon: Coins, label: "CPM Coin Settings" },
  { href: "/admin/vip-codes", icon: KeyRound, label: "VIP Codes" },
  { href: "/admin/support", icon: LifeBuoy, label: "Support Tickets" },
  { href: "/admin/maintenance-support", icon: Wrench, label: "Maintenance Support" },
  { href: "/admin/feedback", icon: Lightbulb, label: "Feedback" },
  { href: "/admin/notifications", icon: Bell, label: "Notifications" },
  { href: "/admin/airdrop", icon: Gift, label: "Airdrop" },
  { href: "/admin/activity-logs", icon: FileClock, label: "Activity Logs" },
  { href: "/admin/pages", icon: FileText, label: "Website Pages" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

function AdminSidebarContent() {
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { auth } = useFirebase();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!loading) {
      const isUserAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
      setIsAdmin(isUserAdmin);
      if (!user) {
        router.push("/");
      } else if (!isUserAdmin) {
        router.push("/dashboard");
      }
    }
  }, [user, loading, router]);
  
  const handleSignOut = async () => {
    if (!auth) return;
    try {
      signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Sign out error", error);
    }
  };

  if (loading || !isAdmin) {
    return <Loader />;
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
            <Logo className="h-8 w-8" />
            <h1 className="text-xl font-bold text-primary font-headline">
              TradeVission Admin
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <AdminSidebarContent />
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
      <main className="flex-1 flex flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border/20 bg-background/50 backdrop-blur-sm px-4 md:justify-end sticky top-0 z-40">
           <div className="flex items-center gap-4 md:hidden">
              <SidebarTrigger />
               <div className="flex items-center gap-2">
                 <Logo className="h-7 w-7" />
                 <h1 className="text-lg font-bold text-primary font-headline">
                    TradeVission Admin
                 </h1>
              </div>
            </div>
          <div className="flex items-center gap-4">
              <AdminNotificationCenter />
          </div>
        </header>
        <div className="bg-background flex-grow p-4 sm:p-6 md:p-8">{children}</div>
        <Footer />
      </main>
    </SidebarProvider>
  );
}