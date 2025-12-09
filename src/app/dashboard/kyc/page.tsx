
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { useFirebase } from "@/lib/firebase/provider";
import { doc, setDoc, serverTimestamp, updateDoc, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoaderCircle, AlertCircle, CheckCircle, ShieldCheck, Upload, User, FileText, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Loader from "@/components/shared/loader";
import { cn } from "@/lib/utils";

interface KYCSubmission {
    status: 'not_submitted' | 'pending' | 'in_review' | 'approved' | 'rejected';
    rejectionReason?: string;
    submittedAt?: any;
    fullName?: string;
    idType?: string;
    idNumber?: string;
    idFrontUrl?: string;
    idBackUrl?: string;
    selfieUrl?: string;
}

export default function KycPage() {
    const { user, loading: authLoading } = useAuth();
    const { db, storage, loading: firebaseLoading } = useFirebase();
    const { toast } = useToast();

    const [kycData, setKycData] = useState<KYCSubmission | null>(null);
    const [loadingData, setLoadingData] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [fullName, setFullName] = useState("");
    const [idType, setIdType] = useState("national_id");
    const [idNumber, setIdNumber] = useState("");
    const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
    const [idBackFile, setIdBackFile] = useState<File | null>(null);
    const [selfieFile, setSelfieFile] = useState<File | null>(null);

    useEffect(() => {
        if (!user || !db) return;
        setLoadingData(true);
        const kycDocRef = doc(db, 'kycSubmissions', user.uid);
        const unsubscribe = onSnapshot(kycDocRef, (doc) => {
            if (doc.exists()) {
                setKycData(doc.data() as KYCSubmission);
                setFullName(doc.data().fullName || user.displayName || "");
                setIdType(doc.data().idType || "national_id");
                setIdNumber(doc.data().idNumber || "");
            } else {
                setKycData({ status: 'not_submitted' });
                setFullName(user.displayName || "");
            }
            setLoadingData(false);
        });
        return () => unsubscribe();
    }, [user, db]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (file: File | null) => void) => {
        if (e.target.files && e.target.files[0]) {
            setter(e.target.files[0]);
        }
    };

    const uploadFile = async (file: File, path: string): Promise<string> => {
        if(!storage) throw new Error("Storage not configured");
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, file);
        return getDownloadURL(storageRef);
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !db || !storage || !fullName || !idType || !idNumber || !idFrontFile || !idBackFile || !selfieFile) {
            toast({ variant: "destructive", title: "Missing Information", description: "Please fill all fields and upload all required documents." });
            return;
        }
        setIsSubmitting(true);
        
        const files = {
            idFrontFile,
            idBackFile,
            selfieFile
        };

        try {
            const kycDocRef = doc(db, 'kycSubmissions', user.uid);
            await setDoc(kycDocRef, {
                userId: user.uid,
                userEmail: user.email,
                fullName,
                idType,
                idNumber,
                status: 'pending',
                submittedAt: serverTimestamp(),
            }, { merge: true });
            
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { kycStatus: 'pending' });

            toast({ title: "KYC Submitted", description: "Your documents are now being uploaded and reviewed." });
            
            setIsSubmitting(false);
            setKycData(prev => ({ ...prev, status: 'pending' }));

            const basePath = `kyc_documents/${user.uid}`;
            const [idFrontUrl, idBackUrl, selfieUrl] = await Promise.all([
                uploadFile(files.idFrontFile, `${basePath}/id_front`),
                uploadFile(files.idBackFile, `${basePath}/id_back`),
                uploadFile(files.selfieFile, `${basePath}/selfie`),
            ]);

            await updateDoc(kycDocRef, {
                idFrontUrl,
                idBackUrl,
                selfieUrl
            });

        } catch (error: any) {
            toast({ variant: "destructive", title: "Submission Failed", description: error.message });
            setIsSubmitting(false);
        }
    };
    
    if (authLoading || firebaseLoading || loadingData) return <Loader />;

    const renderStatus = () => {
        const statusDetails = {
            approved: {
                icon: CheckCircle,
                title: "KYC Verified",
                description: "Your identity has been successfully verified. Thank you!",
                variant: "default",
                className: "bg-green-500/10 border-green-500/30 text-green-300",
                iconClassName: "!text-green-300",
            },
            pending: {
                icon: LoaderCircle,
                title: "Pending Review",
                description: "Your documents have been submitted and are under review. This usually takes 24-48 hours.",
                variant: undefined,
                className: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
                iconClassName: "animate-spin !text-yellow-300",
            },
             in_review: {
                icon: LoaderCircle,
                title: "In Review",
                description: "Our team is actively reviewing your submission. You will be notified once the process is complete.",
                variant: undefined,
                className: "bg-blue-500/10 border-blue-500/30 text-blue-300",
                iconClassName: "animate-spin !text-blue-300",
            },
            rejected: {
                icon: AlertCircle,
                title: "Submission Rejected",
                description: `Reason: ${kycData?.rejectionReason || "No reason provided."} Please resubmit with the correct documents.`,
                variant: "destructive",
                className: "",
                iconClassName: "",
            },
            not_submitted: {
                icon: null,
                title: "",
                description: "",
                variant: undefined,
                className: "hidden",
                iconClassName: ""
            }
        };

        const currentStatus = kycData?.status || 'not_submitted';
        const details = statusDetails[currentStatus];
        
        if (!details.icon) return null;
        
        const Icon = details.icon;

        return (
            <Alert variant={details.variant as any} className={details.className}>
                <Icon className={cn("h-4 w-4", details.iconClassName)} />
                <AlertTitle>{details.title}</AlertTitle>
                <AlertDescription>{details.description}</AlertDescription>
            </Alert>
        );
    };

    const showForm = kycData?.status === 'not_submitted' || kycData?.status === 'rejected';

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="container mx-auto max-w-4xl">
                <Card className="border-border/20 shadow-lg shadow-primary/5 bg-gradient-to-br from-card to-muted/20">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-gradient-to-br from-primary to-accent p-4 rounded-full shadow-lg shadow-primary/20 mb-4">
                            <ShieldCheck className="h-10 w-10 text-white" strokeWidth={2.5}/>
                        </div>
                        <CardTitle className="text-3xl font-bold text-white font-headline">KYC Verification</CardTitle>
                        <CardDescription className="text-white/80">Secure your account by verifying your identity. This is required for full platform access.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {renderStatus()}
                        {showForm && (
                            <form onSubmit={handleSubmit} className="space-y-8 mt-8">
                                <fieldset className="p-6 border rounded-lg border-border/30">
                                    <legend className="px-2 font-bold text-lg text-white flex items-center gap-2"><User /> Personal Details</legend>
                                    <div className="grid md:grid-cols-2 gap-6 mt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="fullName">Full Name (as on ID)</Label>
                                            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="idType">ID Type</Label>
                                            <Select value={idType} onValueChange={setIdType}>
                                                <SelectTrigger id="idType"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="national_id">National ID Card</SelectItem>
                                                    <SelectItem value="passport">Passport</SelectItem>
                                                    <SelectItem value="drivers_license">Driver's License</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2 mt-6">
                                        <Label htmlFor="idNumber">ID Number</Label>
                                        <Input id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} required />
                                    </div>
                                </fieldset>

                                <fieldset className="p-6 border rounded-lg border-border/30">
                                     <legend className="px-2 font-bold text-lg text-white flex items-center gap-2"><FileText /> ID Documents</legend>
                                      <div className="grid md:grid-cols-2 gap-6 mt-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="idFront">ID Document (Front)</Label>
                                            <Input id="idFront" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIdFrontFile)} required />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="idBack">ID Document (Back)</Label>
                                            <Input id="idBack" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setIdBackFile)} required />
                                        </div>
                                      </div>
                                </fieldset>
                                
                                <fieldset className="p-6 border rounded-lg border-border/30">
                                     <legend className="px-2 font-bold text-lg text-white flex items-center gap-2"><Camera /> Selfie</legend>
                                     <div className="mt-4 space-y-2">
                                        <Label htmlFor="selfie">Selfie with ID</Label>
                                        <Input id="selfie" type="file" accept="image/*" onChange={(e) => handleFileChange(e, setSelfieFile)} required />
                                        <p className="text-xs text-muted-foreground">Please upload a clear photo of yourself holding your ID document next to your face.</p>
                                    </div>
                                </fieldset>

                                <Button type="submit" disabled={isSubmitting} className="w-full !mt-10" size="lg">
                                    {isSubmitting ? <LoaderCircle className="animate-spin" /> : <Upload />}
                                    <span>Submit for Verification</span>
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    