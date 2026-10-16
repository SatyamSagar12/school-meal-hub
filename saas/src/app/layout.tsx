import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";

/**
 * No web fonts: system fonts render instantly on a school's phone on
 * mobile data, and there is nothing to self-host or fetch at build time.
 */
export const metadata: Metadata = {
  title: { default: "School Meal Hub", template: "%s — School Meal Hub" },
  description: "Mid-day meal (PM POSHAN) register for government schools: attendance, rice and dal quantities, daily cost and monthly reports.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Meal Hub", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#111a16" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
