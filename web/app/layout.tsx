import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Appraisal Online',
  description: 'AI-powered property valuations and broker leads marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white">
        {children}
      </body>
    </html>
  );
}
