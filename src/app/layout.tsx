import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Padel Tracker",
  description: "Keep tabs on matches, schedule, and standings",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const isSignedIn = Boolean(session?.user);
  const links = [
    { href: "/", label: "Home" },
    { href: "/leagues", label: "Leagues" },
    ...(isSignedIn ? [{ href: "/profile", label: "Profile" }] : []),
    ...(session?.user?.systemRole === "SUPER_ADMIN"
      ? [{ href: "/admins", label: "Admins" }]
      : []),
  ];

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-3 sm:px-6">
          <main className="flex-1 rounded-3xl border border-border/60 bg-card/90 px-4 pb-24 pt-6 shadow-xl backdrop-blur-md sm:px-8 sm:pb-6">
            {children}
          </main>
          <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-3xl -translate-x-1/2 border-t border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80 sm:relative sm:left-0 sm:translate-x-0 sm:bg-transparent">
            <ul className="flex items-center justify-around gap-1 px-2 py-2 text-sm font-medium sm:py-4">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex flex-col items-center gap-1 rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
              <li>
                {isSignedIn ? (
                  <form action={signOutAction}>
                    <Button type="submit" variant="ghost" size="sm">
                      Sign out
                    </Button>
                  </form>
                ) : (
                  <Link
                    href="/sign-in"
                    className="inline-flex flex-col items-center gap-1 rounded-full px-4 py-2 text-muted-foreground transition hover:text-foreground"
                  >
                    <span>Admin sign in</span>
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </body>
    </html>
  );
}
