import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { LayoutDashboard, Users, Activity, Settings, PhoneCall } from 'lucide-react';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Google Business Scraper',
  description: 'Internal SaaS Lead Intelligence Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground flex flex-col`}>
        {/* Navigation Bar */}
        <nav className="border-b bg-card">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
              <Activity className="w-6 h-6" />
              <span>GBS Platform</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <LayoutDashboard className="w-4 h-4" /> Overview
              </Link>
              <Link href="/leads" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <Users className="w-4 h-4" /> Leads Data
              </Link>
              <Link href="/crm" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <PhoneCall className="w-4 h-4" /> CRM
              </Link>
              <Link href="/jobs" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <Activity className="w-4 h-4" /> Job Queue
              </Link>
              <Link href="/settings" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 container mx-auto px-4 py-8">
          {children}
        </main>

        {/* Unregister rogue service workers from other local projects */}
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                for(let registration of registrations) {
                  registration.unregister();
                }
              }).catch(function(err) {
                console.error('Service Worker unregistration failed: ', err);
              });
            }
          `
        }} />
      </body>
    </html>
  );
}
