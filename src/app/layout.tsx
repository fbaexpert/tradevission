
import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/auth-context';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseProvider } from '@/lib/firebase/provider';
import { Inter } from 'next/font/google';
import { Footer } from '@/components/shared/footer';

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
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <main className="flex-grow">{children}</main>
              <Footer />
            </div>
            <Toaster />
          </AuthProvider>
        </FirebaseProvider>
      </body>
    </html>
  );
}
