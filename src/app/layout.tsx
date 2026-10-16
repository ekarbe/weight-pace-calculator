import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from 'next-themes'
import { cn } from "@/lib/utils";
import { I18nProvider } from "@/i18n/provider";
import { SkipLink } from "@/components/ui/skip-link";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  description: "Estimate running pace improvements based on weight loss.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
         className={cn(
            "min-h-screen font-sans antialiased",
            inter.variable
         )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            <SkipLink />
            <div className="mesh-background" aria-hidden />
            {children}
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
