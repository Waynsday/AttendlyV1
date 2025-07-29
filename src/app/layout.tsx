import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DevToolsProvider } from "@/components/providers/devtools-provider";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <DevToolsProvider>
          {children}
        </DevToolsProvider>
      </body>
    </html>
  );
}
