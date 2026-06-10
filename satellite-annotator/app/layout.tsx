import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { QueryProvider } from '@/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OrbitAnnotate — Satellite Image Annotation',
  description: 'AI-powered satellite imagery annotation platform using SAM2, YOLO, and Segformer',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <QueryProvider>
          <div className="stars-bg" />
          <div className="nebula-bg" />
          <div className="scan-line" />
          <Navbar />
          <main className="relative z-10">{children}</main>
        </QueryProvider>
      </body>
    </html>
  );
}
