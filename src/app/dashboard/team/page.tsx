
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
  getDocs,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


interface TeamMember {
  id: string;
  name: string;
  email: string;
  createdAt: Timestamp;
  depositDone: boolean;
  isVip?: boolean;
  level: 1 | 2;
  referredBy?: string; // ID of the L1 referrer
}

interface UserData {
  totalTeamMembers?: number;
  totalTeamDeposit?: number;
  totalReferralBonus?: number;
  totalTeamBonus?: number;
  level1TeamSize?: number;
  level2TeamSize?: number;
  totalTeamCommission?: number;
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

    const fetchTeam = async () => {
        const allMembers: TeamMember[] = [];
        
        // Level 1
        const l1Query = query(collection(db, "users"), where("referredBy", "==", user.uid));
        const l1Snapshot = await getDocs(l1Query);
        const l1Ids = l1Snapshot.docs.map(d => d.id);
        
        for(const memberDoc of l1Snapshot.docs) {
            const memberData = memberDoc.data();
            const coinDoc = await getDoc(doc(db, "cpm_coins", memberDoc.id));
            allMembers.push({
                id: memberDoc.id,
                ...memberData,
                level: 1,
                isVip: coinDoc.exists() && coinDoc.data().amount > 0
            } as TeamMember);
        }
        
        // Level 2
        if (l1Ids.length > 0) {
            // Firestore 'in' query is limited to 30 items
            const l1Chunks = [];
            for (let i = 0; i < l1Ids.length; i += 30) {
                l1Chunks.push(l1Ids.slice(i, i + 30));
            }

            for (const chunk of l1Chunks) {
                const l2Query = query(collection(db, "users"), where("referredBy", "in", chunk));
                const l2Snapshot = await getDocs(l2Query);

                for(const memberDoc of l2Snapshot.docs) {
                    const memberData = memberDoc.data();
                    const coinDoc = await getDoc(doc(db, "cpm_coins", memberDoc.id));
                    allMembers.push({
                        id: memberDoc.id,
                        ...memberData,
                        level: 2,
                        isVip: coinDoc.exists() && coinDoc.data().amount > 0
                    } as TeamMember);
                }
            }
        }
        
        setTeamMembers(allMembers);
        setLoading(false);
    };

    fetchTeam();


    return () => {
      unsubscribeUser();
      unsubscribeSettings();
    };
  }, [user]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm) return teamMembers;
    return teamMembers.filter(member =>
      member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [teamMembers, searchTerm]);
  
  const l1Members = useMemo(() => filteredMembers.filter(m => m.level === 1), [filteredMembers]);
  const l2Members = useMemo(() => filteredMembers.filter(m => m.level === 2), [filteredMembers]);

  if (authLoading || loading) {
    return <Loader />;
  }

  const totalTeamCommission = (userData?.totalReferralBonus || 0) + (userData?.totalTeamBonus || 0);

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="container mx-auto max-w-6xl space-y-8">
        <Card className="border-border/20 shadow-lg shadow-primary/5">
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
                title="Team Commission"
                value={`$${totalTeamCommission.toFixed(2)}`}
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
                      <h3 className="font-bold text-white text-lg">First Deposit Bonus (20%)</h3>
                      <p className="text-sm text-muted-foreground mt-1">When your directly referred member (Level 1) makes their first deposit, you'll receive a 20% bonus of their deposit amount added directly to your balance.</p>
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
                      <h3 className="font-bold text-white text-lg">Daily Team Bonus</h3>
                      <p className="text-sm text-muted-foreground mt-1">Every time a referred member completes their daily task, you'll earn a bonus based on their daily profit. The bonus is 10% for Level 1 members and 2% for Level 2 members.</p>
                  </div>
              </div>
          </div>
      </div>

        <Card className="border-border/20 shadow-lg shadow-primary/5 mt-8">
          <CardHeader>
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-white">Team Members</CardTitle>
                <CardDescription>
                  A list of all users you have referred directly and indirectly.
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
              <Tabs defaultValue="level1">
                  <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="level1">Level 1 ({l1Members.length})</TabsTrigger>
                      <TabsTrigger value="level2">Level 2 ({l2Members.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="level1">
                      {renderTeamTable(l1Members, searchTerm)}
                  </TabsContent>
                  <TabsContent value="level2">
                       {renderTeamTable(l2Members, searchTerm)}
                  </TabsContent>
              </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function renderTeamTable(members: TeamMember[], searchTerm: string) {
    return (
        <div className="overflow-x-auto mt-4">
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
                {members.map((member) => (
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
            {members.length === 0 && (
                <p className="text-center text-muted-foreground mt-6 py-8">
                    {searchTerm ? "No members match your search in this level." : "No members in this level yet."}
                </p>
            )}
        </div>
    );
}

