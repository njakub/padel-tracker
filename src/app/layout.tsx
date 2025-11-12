import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const navLinks = [
  { href: "/", label: "Standings" },
  { href: "/matches", label: "Matches" },
  { href: "/schedule", label: "Schedule" },
];

export const metadata: Metadata = {
  title: "Padel Tracker",
  description: "Keep tabs on matches, schedule, and standings",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col">
          <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-6">
            {children}
          </main>
          <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-3xl -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 sm:relative sm:translate-x-0 sm:bg-transparent">
            <ul className="flex items-center justify-around gap-1 px-2 py-2 text-sm font-medium sm:py-4">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex flex-col items-center gap-1 rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </body>
    </html>
  );
}
