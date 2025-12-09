
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

export type LegalPage = 'privacy' | 'terms' | 'refund' | 'disclaimer' | 'earnings' | 'cookies' | 'risk' | 'anti-fraud' | 'deposit' | 'withdrawal' | 'affiliate' | 'kyc';


const contentMap: Record<LegalPage, { title: string; component: React.ReactNode }> = {
    privacy: {
        title: "Privacy Policy",
        component: (
            <div className="space-y-4">
                <h4 className="font-semibold text-white mt-3 mb-1">Information We Collect</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>Basic account information (name, email, phone number – provided by you)</li>
                    <li>Login details</li>
                    <li>Device information (browser type, IP address)</li>
                    <li>Activity logs (usage history, actions inside the website)</li>
                </ul>
                <h4 className="font-semibold text-white mt-3 mb-1">How We Use Your Information</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>To create and manage your account</li>
                    <li>To improve website performance</li>
                    <li>To provide services, rewards, and payment updates</li>
                    <li>To prevent fraud or unauthorized activity</li>
                    <li>To show ads (if enabled)</li>
                </ul>
                <h4 className="font-semibold text-white mt-3 mb-1">Data Protection</h4>
                <p>We do not sell or share your personal data with any third party except trusted partners needed for: Security, Analytics, and Payment verification.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">User Rights</h4>
                <p>You can request to: Update your information, Delete your account, or Ask what information we store.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">Cookies</h4>
                <p>We use cookies for: Login security, Session management, and a Better user experience.</p>
            </div>
        )
    },
    terms: {
        title: "Terms & Conditions",
        component: (
             <div className="space-y-4">
                 <p>By using TradeVission, you agree to follow all terms mentioned below.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">User Responsibilities</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>Provide accurate information</li>
                    <li>Do not use fake screenshots, fake TIDs, or fraudulent activity</li>
                    <li>Do not misuse rewards or referral system</li>
                    <li>Follow all platform rules</li>
                </ul>
                <h4 className="font-semibold text-white mt-3 mb-1">Payments</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li>All payments require manual verification</li>
                    <li>Admin has full authority to approve or reject fake/unverified payments</li>
                    <li>Processing time may vary</li>
                </ul>
                <h4 className="font-semibold text-white mt-3 mb-1">Account Actions</h4>
                <p>Admin can: Block or delete accounts involved in fraud, Edit balances, Modify services, and Send notifications.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">Changes to Terms</h4>
                <p>We may update these terms anytime. Users will be notified if major changes occur.</p>
            </div>
        )
    },
    refund: {
        title: "Refund Policy",
        component: (
            <div className="space-y-4">
                 <h4 className="font-semibold text-white mt-3 mb-1">Refund Eligibility</h4>
                 <p>Refunds are only possible when: A user makes payment by mistake, Service is not delivered within given time, or a Duplicate payment is made.</p>
                 <h4 className="font-semibold text-white mt-3 mb-1">Non-Refundable</h4>
                 <p>No refund will be given if: User provides wrong details, Fraud is detected, or a User violates platform rules.</p>
                  <h4 className="font-semibold text-white mt-3 mb-1">Refund Process</h4>
                 <p>Provide TID + screenshot. Admin will review. Refund can take 24–72 hours.</p>
            </div>
        )
    },
     disclaimer: {
        title: "Disclaimer",
        component: (
            <div className="space-y-4">
                <p>TradeVission does not guarantee fixed earnings. All rewards depend on: Platform activity, Ads availability, and System policies.</p>
                <p className="mt-2">We are not responsible for: Third-party ads, User mistakes during payments, or Any loss due to misuse.</p>
                 <h4 className="font-semibold text-white mt-3 mb-1">Copyright Policy</h4>
                 <p>All content, design, system logic, and branding (TradeVission) belong to us. Copying, modifying, or reselling our content without permission is not allowed.</p>
            </div>
        )
    },
    earnings: {
        title: "Earnings Disclaimer",
        component: (
             <div className="space-y-4">
                <p>TradeVission makes no guarantees about income or earnings. Any figures shown on our website are estimates of potential earnings only, and should not be considered as typical or guaranteed.</p>
                <p>Trading and investment activities involve significant risk. You should be aware that past performance is not an indicator of future results.</p>
                <p>You are solely responsible for your own financial decisions and outcomes. We do not provide financial, investment, or legal advice. You should consult with a qualified professional before making any financial decisions.</p>
            </div>
        )
    },
    cookies: {
        title: "Cookies Policy",
        component: (
             <div className="space-y-4">
                <h4 className="font-semibold text-white mt-3 mb-1">What Are Cookies?</h4>
                <p>Cookies are small text files stored on your device that help our website function and provide a better user experience.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">Why We Use Them</h4>
                <p>We use cookies for essential functions like keeping you logged in (security), remembering your preferences, and analyzing website traffic (analytics) to improve our service. We do not use cookies for unauthorized tracking or advertising.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">Your Choices</h4>
                <p>You can disable cookies through your browser settings. However, please note that some features of TradeVission may not function correctly without them.</p>
            </div>
        )
    },
    risk: {
        title: "Risk Warning Statement",
        component: (
             <div className="space-y-4">
                <p className="font-bold">Trading, investments, and reward-based activities involve a high level of financial risk. You may lose part or all of your invested capital.</p>
                <p>This platform is provided for educational and entertainment purposes. You should only invest funds that you can afford to lose without impacting your lifestyle.</p>
                <p>TradeVission and its operators are not responsible for any financial losses you may incur. Your participation is at your own risk.</p>
            </div>
        )
    },
    'anti-fraud': {
        title: "Anti-Fraud Policy",
        component: (
             <div className="space-y-4">
                <p>TradeVission maintains a zero-tolerance policy towards any fraudulent activity.</p>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Any use of fake payment details, fraudulent chargebacks, or attempts to misuse the system will result in immediate and permanent account termination.</li>
                    <li>All deposits and withdrawals are subject to manual verification to ensure legitimacy.</li>
                    <li>We encourage users to report any suspicious activity to our support team immediately.</li>
                    <li>The admin team reserves the right to freeze or suspend any account suspected of fraudulent behavior pending investigation.</li>
                 </ul>
            </div>
        )
    },
    deposit: {
        title: "Deposit Policy",
        component: (
             <div className="space-y-4">
                 <ul className="list-disc list-inside space-y-1">
                    <li>All deposits are manually verified by our team to ensure security.</li>
                    <li>You must provide a valid Transaction ID (TID) or screenshot for every deposit.</li>
                    <li>Deposit processing time is typically between 5 to 30 minutes.</li>
                    <li>Once a deposit is confirmed and added to your account balance, it is non-refundable.</li>
                    <li>For your security, we recommend making deposits only from your own verified payment accounts.</li>
                 </ul>
            </div>
        )
    },
    withdrawal: {
        title: "Withdrawal Policy",
        component: (
             <div className="space-y-4">
                <ul className="list-disc list-inside space-y-1">
                    <li>Withdrawal requests are processed manually to ensure accuracy and security.</li>
                    <li>Processing can take anywhere from 5 minutes to 24 hours, depending on network congestion and verification queues.</li>
                    <li>You may only have one pending withdrawal request at a time.</li>
                    <li>It is your responsibility to provide the correct payment details. We are not liable for losses due to incorrect information.</li>
                    <li>The admin team reserves the right to temporarily hold suspicious or high-risk withdrawal requests for further investigation.</li>
                    <li>Minimum and maximum withdrawal limits apply and are stated on the withdrawal page.</li>
                </ul>
            </div>
        )
    },
    affiliate: {
        title: "Affiliate / Referral Program Terms",
        component: (
             <div className="space-y-4">
                 <ul className="list-disc list-inside space-y-1">
                    <li>You earn a commission from the activities of users you refer to the platform.</li>
                    <li>The commission percentage is clearly stated in the "Team" section (e.g., 15% of first deposit, 10% of daily earnings).</li>
                    <li>Any form of spam, fake traffic generation, self-referrals, or other fraudulent methods to gain referrals is strictly prohibited.</li>
                    <li>All earnings from the affiliate program are subject to the same withdrawal rules and policies as other funds.</li>
                    <li>The admin team reserves the right to remove any affiliate and/or forfeit their earnings if they are found to be violating these terms.</li>
                </ul>
            </div>
        )
    },
    kyc: {
        title: "KYC Verification Policy",
        component: (
            <div className="space-y-4">
                <p>To ensure the security of our platform and comply with financial regulations, TradeVission requires users to complete a Know Your Customer (KYC) verification process.</p>
                <h4 className="font-semibold text-white mt-3 mb-1">Why We Require KYC</h4>
                 <ul className="list-disc list-inside space-y-1">
                    <li>To prevent fraud, money laundering, and other illicit activities.</li>
                    <li>To verify your identity and protect your account from unauthorized access.</li>
                    <li>To unlock full platform features, including withdrawals.</li>
                 </ul>
                <h4 className="font-semibold text-white mt-3 mb-1">Information We Collect</h4>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Your full legal name.</li>
                    <li>A government-issued identification document (e.g., National ID, Passport, Driver's License).</li>
                    <li>A live photo (selfie) of you holding your identification document.</li>
                 </ul>
                 <h4 className="font-semibold text-white mt-3 mb-1">How Your Information is Used and Stored</h4>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Your documents are used for identity verification purposes only.</li>
                    <li>All submitted documents are stored securely using industry-standard encryption.</li>
                    <li>Access to your sensitive information is strictly limited to authorized personnel on our compliance team.</li>
                 </ul>
                 <h4 className="font-semibold text-white mt-3 mb-1">The Verification Process</h4>
                 <ul className="list-disc list-inside space-y-1">
                    <li>Submissions are reviewed manually by our team.</li>
                    <li>The process typically takes 24-48 hours.</li>
                    <li>You will be notified via email and on the platform once your status is updated (Approved or Rejected).</li>
                    <li>If your submission is rejected, a reason will be provided, and you will be able to resubmit with the correct information.</li>
                 </ul>
            </div>
        )
    },
};


interface LegalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    content: LegalPage;
}

export function LegalDialog({ open, onOpenChange, content }: LegalDialogProps) {
  if (!contentMap[content]) {
    return null; // or a fallback UI
  }
  const { title, component } = contentMap[content];
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Last Updated: 7 December 2025
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 pr-6">
            <div className="space-y-6 text-sm text-muted-foreground">
                {component}
            </div>
        </ScrollArea>
        <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
