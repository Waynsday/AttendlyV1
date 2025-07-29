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
        {/* Load devtools blocker script as early as possible */}
        {process.env.NODE_ENV === 'development' && (
          <script 
            src="/devtools-blocker.js" 
            defer={false}
            async={false}
          />
        )}
      </head>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <DevToolsProvider>
          {children}
        </DevToolsProvider>
      </body>
    </html>
  );
}
