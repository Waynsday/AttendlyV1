import type { Metadata } from "next";
import { Montserrat, Syne } from "next/font/google";
import "./globals.css";
import { DevToolsProvider } from "@/components/providers/devtools-provider";
import { cn } from "@/presentation/utils/cn";

// Font configuration from design-tokens.json
const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: "700",
});

export const metadata: Metadata = {
  title: "AttendlyV1 - School Attendance Recovery System",
  description: "FERPA-compliant attendance tracking and recovery system for Romoland School District",
  keywords: "attendance, school, education, FERPA, student data, compliance",
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
          "min-h-screen bg-romoland-light-bg font-sans text-romoland-text antialiased",
          montserrat.variable,
          syne.variable
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
