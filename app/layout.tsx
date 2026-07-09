import type { Metadata } from "next";
import Link from "next/link";
import "katex/dist/katex.min.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AMC 10 Trainer",
  description:
    "Practice for the AMC 10 with the full 2000-2024 problem bank, topic drills, and an AI coach.",
};

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/drill", label: "Drill" },
  { href: "/test", label: "Test" },
  { href: "/generate", label: "Generate" },
  { href: "/tutor", label: "Tutor" },
  { href: "/plan", label: "Plan" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-navy-700 bg-navy-900/80 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto max-w-7xl px-4 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-bold">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-accent text-white font-mono text-sm">
                Σ
              </span>
              <span>
                AMC 10 <span className="text-accent-bright">Trainer</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-3 py-1.5 rounded-md text-ink-dim hover:text-ink hover:bg-navy-800 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
