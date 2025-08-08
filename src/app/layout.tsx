import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DevToolsProvider } from "@/components/providers/devtools-provider";
import { cn } from "@/presentation/utils/cn";

// Attendly Brand Typography - Inter Font System
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Attendly - End Administrative Agony",
  description: "Purpose-built for California educators who want to focus on students, not paperwork. Seamless Aeries SIS integration and automated excellence.",
  keywords: "attendance, school, education, FERPA, student data, compliance, Aeries, California, educators",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* RSC-compatible head - no external devtools scripts */}
      </head>
      <body 
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          inter.variable
        )} 
        suppressHydrationWarning
      >
        <DevToolsProvider>
          {children}
        </DevToolsProvider>
      </body>
    </html>
  );
}
