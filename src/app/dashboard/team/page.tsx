
"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { getFirebase } from "@/lib/firebase/config";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users2, DollarSign, Zap, BarChart, Gift, ShieldCheck, Trophy, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import Loader from "@/components/shared/loader";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  depositDone: boolean;
  isVip?: boolean;
}

interface UserData {
  totalTeamMembers?: number;
  totalTeamDeposit?: number;
  totalReferralBonus?: number;
  totalTeamBonus?: number;
}

interface CommanderSettings {
    weeklySalary: number;
    weeklyCpmCoins: number;
    referralRequirement: number;
}

interface SuperBonusTier {
    referrals: number;
    bonus: number;
}

const StatCard = ({ title, value, icon: Icon, iconColor, gradient }: { title: string; value: string; icon: React.ElementType; iconColor?: string; gradient?: string; }) => (
  <div className={cn("relative overflow-hidden rounded-xl p-4 border border-border/20", gradient)}>
    <div className="flex items-start justify-between space-y-0">
      <div className="grid gap-1">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
      <div className="p-2 bg-black/20 rounded-md">
         <Icon className={cn("h-5 w-5", iconColor)} />
      </div>
    </div>
  </div>
);

export default function TeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [superBonusTiers, setSuperBonusTiers] = useState<SuperBonusTier[]>([]);
  const [commanderSettings, setCommanderSettings] = useState<CommanderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!user) return;

    const { db } = getFirebase();

    const userDocRef = doc(db, "users", user.uid);
    const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
      setUserData(doc.data() as UserData);
    });

    const settingsDocRef = doc(db, "system", "settings");
    const unsubscribeSettings = onSnapshot(settingsDocRef, (doc) => {
        if(doc.exists()){
            const data = doc.data();
            setSuperBonusTiers(data.superBonusTiers || []);
            setCommanderSettings(data.commander || null);
        }
    });

    const teamQuery = query(
      collection(db, "users"),
      where("referredBy", "==", user.uid)
    );
    const unsubscribeTeam = onSnapshot(teamQuery, async (snapshot) => {
       const memberPromises = snapshot.docs.map(async (memberDoc) => {
        const member = { id: memberDoc.id, ...memberDoc.data() } as TeamMember;
        const coinDocRef = doc(db, 'cpm_coins', member.id);
        const coinDoc = await getDoc(coinDocRef);
        member.isVip = coinDoc.exists() && coinDoc.data().amount > 0;
        return member;
      });
      const members = await Promise.all(memberPromises);
      setTeamMembers(members);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeSettings();
      unsubscribeTeam();
    };
  }, [user]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return teamMembers;
    return teamMembers.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamMembers, searchTerm]);

  if (authLoading || loading) {
    return <Loader />;
  }

  return (
    <div className="space-y-8">
      <Card className="border-border/20 shadow-lg shadow-primary/5 bg-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-3xl font-bold text-white font-headline">
            <Users2 /> Your Team
          </CardTitle>
          <CardDescription>
            Track your referrals and bonuses in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Team Members"
              value={String(userData?.totalTeamMembers || 0)}
              icon={Users2}
              iconColor="text-yellow-400"
              gradient="bg-gradient-to-br from-yellow-900/40 via-background to-background"
            />
            <StatCard
              title="Team Deposit"
              value={`$${(userData?.totalTeamDeposit || 0).toFixed(2)}`}
              icon={DollarSign}
              iconColor="text-green-400"
              gradient="bg-gradient-to-br from-green-900/40 via-background to-background"
            />
            <StatCard
              title="Referral Bonus"
              value={`$${(userData?.totalReferralBonus || 0).toFixed(2)}`}
              icon={BarChart}
              iconColor="text-purple-400"
              gradient="bg-gradient-to-br from-purple-900/40 via-background to-background"
            />
            <StatCard
              title="Daily Team Bonus"
              value={`$${(userData?.totalTeamBonus || 0).toFixed(2)}`}
              icon={Zap}
              iconColor="text-blue-400"
              gradient="bg-gradient-to-br from-blue-900/40 via-background to-background"
            />
          </div>
        </CardContent>
      </Card>
      
      <div className="space-y-4">
        <div className="relative p-6 rounded-lg border-2 border-primary/50 bg-gradient-to-br from-primary/20 via-background to-background overflow-hidden group">
            <div className="absolute -top-12 -right-12 text-primary/10 group-hover:text-primary/20 transition-colors duration-500">
                <Gift size={160} strokeWidth={1} />
            </div>
             <div className="relative z-10 flex items-start gap-4">
                <div className="p-3 rounded-full bg-primary/20 border border-primary/30">
                  <Gift className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">First Deposit Bonus (15%)</h3>
                    <p className="text-sm text-muted-foreground mt-1">When your referred member makes their first deposit, you'll receive a 15% bonus of their deposit amount added directly to your balance.</p>
                </div>
             </div>
        </div>
         <div className="relative p-6 rounded-lg border-2 border-green-500/50 bg-gradient-to-br from-green-900/40 via-background to-background overflow-hidden group">
            <div className="absolute -top-12 -right-12 text-green-400/10 group-hover:text-green-400/20 transition-colors duration-500">
                <Zap size={160} strokeWidth={1} />
            </div>
            <div className="relative z-10 flex items-start gap-4">
                 <div className="p-3 rounded-full bg-green-500/20 border border-green-500/30">
                    <Zap className="h-6 w-6 text-green-400" />
                 </div>
                <div>
                    <h3 className="font-bold text-white text-lg">Daily Team Bonus (10%)</h3>
                    <p className="text-sm text-muted-foreground mt-1">Every time a referred member completes their daily task (watches an ad), you'll earn a 10% bonus based on their daily profit.</p>
                </div>
            </div>
        </div>
        <div className="relative p-6 rounded-lg border-2 border-yellow-500/50 bg-gradient-to-br from-yellow-900/40 via-background to-background overflow-hidden group">
            <div className="absolute -top-12 -right-12 text-yellow-400/10 group-hover:text-yellow-400/20 transition-colors duration-500">
                <Trophy size={160} strokeWidth={1}/>
            </div>
            <div className="absolute inset-0 bg-grid-yellow opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                   <div className="p-3 rounded-full bg-yellow-500/20 border border-yellow-500/30">
                     <Trophy className="h-8 w-8 text-yellow-400" />
                   </div>
                   <div>
                      <h3 className="font-extrabold text-white text-xl">Super Bonus Rewards</h3>
                      <p className="text-sm text-yellow-400/80">Unlock exclusive cash rewards for growing your team.</p>
                   </div>
                </div>
                <ul className="space-y-2">
                {superBonusTiers.map(tier => (
                    <li key={tier.referrals} className="flex items-center gap-3 text-sm p-3 rounded-md bg-black/20 border border-white/10 backdrop-blur-sm">
                       <ShieldCheck className="h-5 w-5 text-yellow-500 flex-shrink-0"/>
                       <div>
                            <span className="font-bold text-white">{tier.referrals} Team Members</span>
                            <span className="text-muted-foreground mx-2"> unlocks a </span> 
                            <span className="font-bold text-green-400 text-base">${tier.bonus} Bonus</span>
                       </div>
                    </li>
                ))}
                </ul>
            </div>
             <style jsx>{`
                .bg-grid-yellow {
                    background-image: 
                        linear-gradient(to right, rgba(234, 179, 8, 0.1) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(234, 179, 8, 0.1) 1px, transparent 1px);
                    background-size: 2rem 2rem;
                }
            `}</style>
        </div>
        {commanderSettings && (
             <div className="relative p-6 rounded-lg border-2 border-amber-500/50 bg-gradient-to-br from-amber-900/40 via-background to-background overflow-hidden group">
                 <div className="absolute -top-12 -right-12 text-amber-400/10 group-hover:text-amber-400/20 transition-colors duration-500">
                    <Star size={160} strokeWidth={1} />
                </div>
                 <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-full bg-amber-500/20 border border-amber-500/30">
                            <Star className="h-8 w-8 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-white text-xl">Become a Commander</h3>
                            <p className="text-sm text-amber-400/80">Achieve elite status and unlock exclusive rewards.</p>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
                        <div className="p-3 rounded-md bg-black/20 border border-white/10 backdrop-blur-sm">
                            <p className="text-xs text-muted-foreground">Requirement</p>
                            <p className="text-lg font-bold text-white">{commanderSettings.referralRequirement}+ Team Members</p>
                        </div>
                         <div className="p-3 rounded-md bg-black/20 border border-white/10 backdrop-blur-sm">
                           <p className="text-xs text-muted-foreground">Commander Badge</p>
                           <Badge className="mt-1.5 bg-gradient-to-br from-yellow-400 to-amber-500 text-black border-yellow-600 text-sm shadow-lg shadow-amber-500/40">
                               <Star className="h-4 w-4 mr-1.5 text-black"/> Commander
                           </Badge>
                        </div>
                        <div className="p-3 rounded-md bg-black/20 border border-white/10 backdrop-blur-sm">
                            <p className="text-xs text-muted-foreground">Weekly Salary</p>
                            <p className="text-lg font-bold text-green-400">${commanderSettings.weeklySalary}</p>
                        </div>
                        <div className="p-3 rounded-md bg-black/20 border border-white/10 backdrop-blur-sm">
                            <p className="text-xs text-muted-foreground">Weekly CPM Coins</p>
                            <p className="text-lg font-bold text-yellow-400">{commanderSettings.weeklyCpmCoins} CPM</p>
                        </div>
                    </div>
                </div>
            </div>
        )}
        <p className="text-xs text-center text-muted-foreground pt-2">Share your referral link from the dashboard to start building your team and earning rewards!</p>
    </div>

      <Card className="border-border/20 shadow-lg shadow-primary/5 mt-8">
        <CardHeader>
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-xl font-bold text-white">Team Members</CardTitle>
              <CardDescription>
                A list of all users you have referred.
              </CardDescription>
            </div>
            <Input
              placeholder="Search by name or email..."
              className="max-w-full md:max-w-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Signup Date</TableHead>
                  <TableHead>First Deposit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id} className={cn("hover:bg-muted/50", member.isVip && "bg-purple-900/20 hover:bg-purple-900/30")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.name}</span>
                        {member.isVip && 
                             <Badge className="bg-gradient-to-br from-purple-600 to-indigo-700 text-yellow-300 border-purple-400 shadow-lg shadow-purple-500/20">
                                <ShieldCheck className="h-3 w-3 mr-1 text-yellow-400"/> VIP
                            </Badge>
                        }
                      </div>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {member.createdAt
                        ? new Date(
                            member.createdAt.seconds * 1000
                          ).toLocaleDateString()
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          member.depositDone ? "default" : "destructive"
                        }
                      >
                        {member.depositDone ? "Completed" : "Pending"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
           {!loading && filteredMembers.length === 0 && (
            <p className="text-center text-muted-foreground mt-6 py-8">
              {searchTerm ? "No members match your search." : "You haven't referred anyone yet. Share your link to start!"}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    