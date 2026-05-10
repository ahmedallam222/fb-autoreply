import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'fb-autoreply',
  description: 'Auto-reply SaaS for Facebook page comments and messages',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
