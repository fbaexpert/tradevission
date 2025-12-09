
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

export function TermsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <span className="text-primary underline cursor-pointer hover:text-primary/80">Terms of Use and Privacy Policy</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Legal Information</DialogTitle>
          <DialogDescription>
            Last Updated: 7 December 2025. Please read our terms and policies carefully.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 pr-6">
            <div className="space-y-6 text-sm text-muted-foreground">
                <section>
                    <h3 className="font-bold text-white mb-2 text-lg">Privacy Policy</h3>
                    <p>Welcome to TradeVission. We value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and protect your data.</p>
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
                </section>
                <section>
                    <h3 className="font-bold text-white mb-2 text-lg">Terms & Conditions</h3>
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
                </section>
                <section>
                    <h3 className="font-bold text-white mb-2 text-lg">Refund Policy</h3>
                     <h4 className="font-semibold text-white mt-3 mb-1">Refund Eligibility</h4>
                     <p>Refunds are only possible when: A user makes payment by mistake, Service is not delivered within given time, or a Duplicate payment is made.</p>
                     <h4 className="font-semibold text-white mt-3 mb-1">Non-Refundable</h4>
                     <p>No refund will be given if: User provides wrong details, Fraud is detected, or a User violates platform rules.</p>
                      <h4 className="font-semibold text-white mt-3 mb-1">Refund Process</h4>
                     <p>Provide TID + screenshot. Admin will review. Refund can take 24–72 hours.</p>
                </section>
                 <section>
                    <h3 className="font-bold text-white mb-2 text-lg">Disclaimer</h3>
                    <p>TradeVission does not guarantee fixed earnings. All rewards depend on: Platform activity, Ads availability, and System policies.</p>
                    <p className="mt-2">We are not responsible for: Third-party ads, User mistakes during payments, or Any loss due to misuse.</p>
                </section>
                 <section>
                    <h3 className="font-bold text-white mb-2 text-lg">Copyright Policy</h3>
                    <p>All content, design, system logic, and branding (TradeVission) belong to us. Copying, modifying, or reselling our content without permission is not allowed.</p>
                </section>
            </div>
        </ScrollArea>
        <DialogFooter>
            <DialogTrigger asChild>
                <Button>I Understand</Button>
            </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
