import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';

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
        <Navbar />

        {/* Main Content Area */}
        <main className="flex-1 container mx-auto px-3 py-4 sm:px-4 sm:py-8 overflow-x-hidden">
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
