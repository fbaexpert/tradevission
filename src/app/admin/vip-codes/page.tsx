
"use client";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  onSnapshot,
  doc,
  writeBatch,
  serverTimestamp,
  orderBy,
  Timestamp,
  deleteDoc,
  getDocs,
} from "firebase/firestore";
import { nanoid } from 'nanoid';
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  LoaderCircle,
  KeyRound,
  Trash2,
  Copy,
  PlusCircle,
  Gift,
  Send,
  User,
  ChevronsUpDown,
  Check,
  Palette
} from "lucide-react";
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
import { useFirebase } from "@/lib/firebase/provider";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useIsMobile } from "@/hooks/use-mobile";


type RewardType = 'BALANCE' | 'CPM_COIN' | 'VIP_STATUS' | 'CUSTOM_BADGE';

interface VipCode {
  id: string;
  code: string;
  status: 'available' | 'redeemed';
  createdAt: Timestamp;
  rewardType: RewardType;
  rewardValue: number;
  description: string;
  badgeName?: string;
  badgeColor?: string;
  redeemedBy?: string;
  redeemedAt?: Timestamp;
  redeemedByEmail?: string;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
}

const rewardTypeLabels: Record<RewardType, string> = {
    BALANCE: "Balance (USD)",
    CPM_COIN: "CPM Coins",
    VIP_STATUS: "VIP Status",
    CUSTOM_BADGE: "Custom Badge",
};

function UserSelector({ users, onSelect }: { users: AppUser[], onSelect: (value: string | null) => void }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserIdState] = useState<string | null>(null);

  const handleSelect = (userId: string) => {
    setSelectedUserIdState(userId);
    onSelect(userId);
    setOpen(false);
  };
  
  const selectedUserEmail = selectedUserId ? users.find(u => u.id === selectedUserId)?.email : "Select user...";

  const UserList = (
     <Command>
        <CommandInput placeholder="Search user by email or name..." />
        <CommandList>
            <CommandEmpty>No user found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-y-auto">
                {users.map((user) => (
                <CommandItem
                    key={user.id}
                    value={user.email}
                    onSelect={() => handleSelect(user.id)}
                    onClick={() => handleSelect(user.id)}
                >
                    <div className="flex w-full items-center">
                        <Check className={cn("mr-2 h-4 w-4", user.id === selectedUserId ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                    </div>
                </CommandItem>
                ))}
            </CommandGroup>
        </CommandList>
    </Command>
  );

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {selectedUserEmail}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DialogTrigger>
        <DialogContent className="p-0">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>Select User</DialogTitle>
          </DialogHeader>
          {UserList}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
            {selectedUserEmail}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        {UserList}
      </PopoverContent>
    </Popover>
  );
}


export default function AdminVipCodesPage() {
  const { db, loading: firebaseLoading } = useFirebase();
  const [codes, setCodes] = useState<VipCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [rewardType, setRewardType] = useState<RewardType>('VIP_STATUS');
  const [rewardValue, setRewardValue] = useState("1");
  const [badgeName, setBadgeName] = useState("");
  const [badgeColor, setBadgeColor] = useState("#4f46e5");
  const { toast } = useToast();
  
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [selectedCode, setSelectedCode] = useState<VipCode | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!db || firebaseLoading) return;
    setLoading(true);

    const q = query(collection(db, "vipCodes"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const codesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VipCode));
      setCodes(codesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching VIP codes:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not fetch VIP codes." });
      setLoading(false);
    });

    const usersQuery = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppUser));
        setUsers(usersData);
    });


    return () => {
        unsubscribe();
        unsubscribeUsers();
    };
  }, [db, toast, firebaseLoading]);
  
  const handleGenerateCodes = async () => {
    if (!db) return;
    const num = parseInt(quantity, 10);
    const value = parseFloat(rewardValue);

    if (isNaN(num) || num <= 0 || num > 100) {
        toast({ variant: "destructive", title: "Invalid Quantity", description: "Please enter a number between 1 and 100." });
        return;
    }
    if (rewardType !== 'VIP_STATUS' && rewardType !== 'CUSTOM_BADGE' && (isNaN(value) || value <= 0)) {
        toast({ variant: "destructive", title: "Invalid Value", description: "Reward value must be a positive number for this reward type." });
        return;
    }
    if (rewardType === 'CUSTOM_BADGE' && !badgeName.trim()) {
        toast({ variant: "destructive", title: "Invalid Badge Name", description: "Badge name is required for custom badges." });
        return;
    }
    
    setGenerating(true);
    let description = "";
    const payload: Partial<VipCode> = {
        rewardType,
    };

    switch(rewardType){
        case 'BALANCE': 
            description = `Adds $${value} to balance`;
            payload.rewardValue = value;
            break;
        case 'CPM_COIN': 
            description = `Grants ${value} CPM Coin(s)`;
            payload.rewardValue = value;
            break;
        case 'VIP_STATUS': 
            description = 'Grants VIP Status'; 
            payload.rewardValue = 1;
            break;
        case 'CUSTOM_BADGE':
            description = `Grants the "${badgeName}" badge`;
            payload.badgeName = badgeName;
            payload.badgeColor = badgeColor;
            payload.rewardValue = 0; // No numerical value for badges
            break;
    }
    payload.description = description;

    try {
        const batch = writeBatch(db);
        for (let i = 0; i < num; i++) {
            const code = nanoid(12).toUpperCase();
            const codeRef = doc(db, "vipCodes", code);
            batch.set(codeRef, {
                ...payload,
                code,
                status: 'available',
                createdAt: serverTimestamp(),
            });
        }

        await batch.commit();

        toast({ title: "Codes Generated", description: `${num} new VIP code(s) have been created.` });

    } catch (error) {
        console.error("Error generating codes:", error);
        toast({ variant: "destructive", title: "Generation Failed", description: "An unexpected error occurred." });
    } finally {
        setGenerating(false);
    }
  }


  const handleDeleteCode = async (codeId: string) => {
    if (!db) return;
    deleteDoc(doc(db, "vipCodes", codeId)).then(() => {
        toast({ title: "Code Deleted", description: "The VIP code has been removed." });
    }).catch((error) => {
        console.error("Error deleting code:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not delete the code." });
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard!" });
  };

  const openSendDialog = (code: VipCode) => {
    setSelectedCode(code);
    setSelectedUserId(null);
    setIsSendDialogOpen(true);
  }
  
  const handleSendCode = async () => {
    if(!db || !selectedCode || !selectedUserId) return;

    setIsSending(true);
    try {
        const batch = writeBatch(db);
        
        // Add code to user's VIP Mailbox
        const mailboxRef = doc(collection(db, "users", selectedUserId, "vipMailbox"));
        batch.set(mailboxRef, {
            code: selectedCode.code,
            description: selectedCode.description,
            sentAt: serverTimestamp()
        });

        // Send a notification to the user
        const notifRef = doc(collection(db, "users", selectedUserId, "notifications"));
        batch.set(notifRef, {
             userId: selectedUserId,
            type: 'success',
            title: '🎁 You Received a VIP Code!',
            message: `A special reward code has been sent to your VIP Mailbox on the Redeem Code page.`,
            status: 'unread',
            seen: false,
            createdAt: serverTimestamp(),
            relatedId: selectedCode.code,
        });

        await batch.commit();
        toast({ title: "Code Sent!", description: `The code has been sent to the user's VIP Mailbox.` });
        setIsSendDialogOpen(false);

    } catch (error) {
         console.error("Error sending code:", error);
        toast({ variant: "destructive", title: "Failed to Send", description: "An unexpected error occurred." });
    } finally {
        setIsSending(false);
    }
  }
  
  if (loading || firebaseLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoaderCircle className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }
  
  const getRewardValueLabel = () => {
    switch (rewardType) {
        case 'BALANCE': return 'Amount ($)';
        case 'CPM_COIN': return 'Number of Coins';
        default: return 'Value';
    }
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <CardTitle className="flex items-center gap-2 text-white font-bold">
                <KeyRound />
                VIP Redeem Codes
                </CardTitle>
                <CardDescription>
                Generate and manage codes for users to redeem for VIP status or other rewards.
                </CardDescription>
            </div>
        </div>
      </CardHeader>
      <CardContent>
         {/* Generation Form */}
         <div className="p-4 border rounded-lg bg-muted/30 mb-6">
            <h3 className="font-bold text-lg mb-4 text-white">Generate New Codes</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                    <Label htmlFor="reward-type">Reward Type</Label>
                    <Select value={rewardType} onValueChange={(v) => setRewardType(v as RewardType)}>
                        <SelectTrigger id="reward-type">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                           {Object.entries(rewardTypeLabels).map(([key, label]) => (
                             <SelectItem key={key} value={key}>{label}</SelectItem>
                           ))}
                        </SelectContent>
                    </Select>
                </div>
                 {rewardType === 'CUSTOM_BADGE' ? (
                     <>
                        <div className="space-y-2">
                             <Label htmlFor="badge-name">Badge Name</Label>
                             <Input
                                id="badge-name"
                                type="text"
                                placeholder="e.g., Top Referrer"
                                value={badgeName}
                                onChange={(e) => setBadgeName(e.target.value)}
                            />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="badge-color">Badge Color</Label>
                            <div className="flex items-center gap-2 h-10 border border-input rounded-md bg-background px-3">
                               <Palette className="h-4 w-4 text-muted-foreground"/>
                               <Input
                                    id="badge-color"
                                    type="color"
                                    value={badgeColor}
                                    onChange={(e) => setBadgeColor(e.target.value)}
                                    className="p-0 border-0 h-8 w-8 bg-transparent"
                                />
                                <span className="font-mono">{badgeColor}</span>
                            </div>
                        </div>
                     </>
                 ) : (
                    <div className="space-y-2">
                        <Label htmlFor="reward-value">{getRewardValueLabel()}</Label>
                        <Input
                            id="reward-value"
                            type="number"
                            placeholder="e.g., 50"
                            value={rewardValue}
                            onChange={(e) => setRewardValue(e.target.value)}
                            min="1"
                            disabled={rewardType === 'VIP_STATUS'}
                        />
                    </div>
                 )}
                 <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                        id="quantity"
                        type="number"
                        placeholder="e.g., 10"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        min="1"
                        max="100"
                    />
                </div>
                 <Button onClick={handleGenerateCodes} disabled={generating}>
                    {generating ? <LoaderCircle className="animate-spin mr-2"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                    Generate
                </Button>
            </div>
         </div>

        {loading ? (
          <div className="flex justify-center items-center h-40">
            <LoaderCircle className="animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Redeemed By</TableHead>
                  <TableHead>Redeemed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-mono text-white">
                        <div className="flex items-center gap-2">
                           {code.code}
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => copyToClipboard(code.code)}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    </TableCell>
                    <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1.5">
                           <Gift className="h-3 w-3 text-primary"/> {code.description}
                        </Badge>
                    </TableCell>
                     <TableCell>
                      <Badge variant={code.status === 'available' ? 'default' : 'secondary'} className="capitalize">
                        {code.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{code.createdAt ? code.createdAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{code.redeemedByEmail || 'N/A'}</TableCell>
                    <TableCell className="whitespace-nowrap">{code.redeemedAt ? code.redeemedAt.toDate().toLocaleString() : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex items-center justify-end gap-2">
                        {code.status === 'available' && (
                             <Button variant="outline" size="sm" onClick={() => openSendDialog(code)}>
                                <Send className="h-4 w-4 mr-2"/> Send to User
                            </Button>
                        )}
                       <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-destructive shrink-0">
                                    <Trash2 className="h-4 w-4"/>
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Code?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to delete this VIP code? This action is irreversible.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCode(code.id)} className="bg-destructive hover:bg-destructive/90">
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
             {codes.length === 0 && <p className="text-center text-muted-foreground p-8">No codes generated yet.</p>}
          </div>
        )}
      </CardContent>
    </Card>
    
     <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Code to User</DialogTitle>
            <DialogDescription>
              Select a user to send the VIP code <span className="font-bold text-white font-mono">{selectedCode?.code}</span> to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>User</Label>
            <UserSelector users={users} onSelect={setSelectedUserId} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={handleSendCode} disabled={isSending || !selectedUserId}>
              {isSending ? <LoaderCircle className="animate-spin" /> : "Send Code"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
