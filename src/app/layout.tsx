import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Factify.AI",
  description: "AI-powered fact-checking for text, URLs, and images",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="fixed inset-0 bg-noise opacity-[0.015] pointer-events-none" />
        <main className="relative min-h-screen bg-cream text-wine-dark">
          <div className="absolute inset-0 bg-gradient-radial from-cream to-cream-muted opacity-50" />
          <div className="relative">
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
