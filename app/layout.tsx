import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import AuthSessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import AiQueryWidget from "@/components/AiQueryWidget";

export const metadata: Metadata = {
  title: "PotTracker",
  description: "Track buy-ins, cash-outs, and settle debts for your home poker group.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} ${GeistSans.className} relative`}>
        <AuthSessionProvider>
          <Nav />
          <div className="relative z-10">{children}</div>
          <AiQueryWidget />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
