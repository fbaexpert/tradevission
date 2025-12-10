import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/lib/firebase/provider';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'TradeVission',
  description: 'A modern trading analysis platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
// TRADEVISSION REFERRAL FIX - DO NOT REMOVE

(function() {
    // 1. CAPTURE REFERRAL CODE FROM URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    
    if (refCode) {
        // Save immediately
        localStorage.setItem('tradevission_ref', refCode);
        console.log('✅ Referral code saved:', refCode);
        
        // Show notification on homepage
        if (window.location.pathname === '/') {
            setTimeout(() => {
                const notification = document.createElement('div');
                notification.innerHTML = \`
                    <div style="
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        color: white;
                        padding: 15px 20px;
                        border-radius: 10px;
                        z-index: 9999;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                        font-family: Arial, sans-serif;
                        max-width: 300px;
                    ">
                        <strong>🎉 Special Invitation!</strong><br>
                        <small>You've been invited to join TradeVission</small>
                    </div>
                \`;
                document.body.appendChild(notification);
                
                // Auto remove after 5 seconds
                setTimeout(() => notification.remove(), 5000);
            }, 1000);
        }
    }
    
    // 2. FIX "GET STARTED NOW" BUTTON
    document.addEventListener('DOMContentLoaded', function() {
        const refCode = localStorage.getItem('tradevission_ref');
        
        if (refCode) {
            // Fix ALL "Get Started Now" buttons
            const getStartedButtons = document.querySelectorAll('a, button');
            
            getStartedButtons.forEach(btn => {
                const href = btn.getAttribute('href');
                const btnText = btn.textContent || btn.innerText;
                
                // Check if this is a Get Started button
                if ((href && (href.includes('/login') || href.includes('/signup') || 
                     href.includes('/register') || href.includes('get-started'))) ||
                    (btnText && (btnText.toLowerCase().includes('get started') ||
                    btnText.toLowerCase().includes('sign up') ||
                    btnText.toLowerCase().includes('create account')))) {
                    
                    // Modify the link
                    if (href && !href.includes('?')) {
                        btn.setAttribute('href', href + '?ref=' + refCode);
                    } else if (href && href.includes('?') && !href.includes('ref=')) {
                        btn.setAttribute('href', href + '&ref=' + refCode);
                    }
                    
                    // Also modify onclick events
                    const onClick = btn.getAttribute('onclick');
                    if (onClick && onClick.includes('window.location')) {
                        const newOnClick = onClick.replace(
                            /window\\.location\\.href\\s*=\\s*['"]([^'"]+)['"]/g,
                            function(match, url) {
                                return 'window.location.href="' + url + '?ref=' + refCode + '"';
                            }
                        );
                        btn.setAttribute('onclick', newOnClick);
                    }
                }
            });
            
            // 3. SHOW ON LOGIN/SIGNUP PAGES
            if (window.location.pathname.includes('/login') || 
                window.location.pathname.includes('/signup')) {
                
                // Create invitation banner
                const banner = document.createElement('div');
                banner.style.cssText = \`
                    background: linear-gradient(to right, #4CAF50, #2E7D32);
                    color: white;
                    padding: 15px;
                    text-align: center;
                    font-family: Arial, sans-serif;
                    margin-bottom: 20px;
                    border-radius: 8px;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.1);
                \`;
                
                banner.innerHTML = \`
                    <strong>🎊 SPECIAL INVITATION</strong><br>
                    You were invited by a TradeVission member!<br>
                    <small>Complete signup to join their team & earn bonuses</small>
                \`;
                
                // Add to page
                const form = document.querySelector('form');
                if (form) {
                    form.parentNode.insertBefore(banner, form);
                    
                    // Add hidden input to ALL forms on page
                    document.querySelectorAll('form').forEach(form => {
                        let refInput = form.querySelector('input[name="referral_code"]');
                        if (!refInput) {
                            refInput = document.createElement('input');
                            refInput.type = 'hidden';
                            refInput.name = 'referral_code';
                            refInput.value = refCode;
                            form.appendChild(refInput);
                        }
                    });
                }
            }
        }
    });
    
    // 4. PREVENT FORM SUBMISSION LOSS
    window.addEventListener('beforeunload', function() {
        const refCode = localStorage.getItem('tradevission_ref');
        if (refCode) {
            // Ensure it persists
            sessionStorage.setItem('tradevission_ref_backup', refCode);
        }
    });
})();
          `,
          }}
        />
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
