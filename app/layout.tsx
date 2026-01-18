import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { UserProvider } from "@/contexts/UserContext";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Reminders } from "@/components/reminders";
import { PopUp } from "@/components/ticket-received";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap", // add this if missing, for better font loading
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});
export const metadata: Metadata = {
  title: "Stash - IT Asset Management System",
  description: "Localized IT Asset Management System built with Next.js and Tailwind CSS",
  icons: {
    icon: "/asset.jpg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <UserProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <Reminders />
            <PopUp />
            {children}
          </ThemeProvider>
          <Toaster richColors />
        </UserProvider>
      </body>
    </html>
  );
}
