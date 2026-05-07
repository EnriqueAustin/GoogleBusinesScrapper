import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import Navbar from '@/components/Navbar';
import { DatasetProvider } from '@/lib/dataset-context';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LeadLens',
  description: 'Lead intelligence platform for local business prospecting',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-background text-foreground flex flex-col`}>
        <Suspense>
        <DatasetProvider>
        <Navbar />

        <main className="flex-1 container mx-auto px-3 py-4 sm:px-4 sm:py-8 overflow-x-hidden">
          {children}
        </main>

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
        </DatasetProvider>
        </Suspense>
      </body>
    </html>
  );
}
