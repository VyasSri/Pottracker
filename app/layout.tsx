import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/SessionProvider";
import Nav from "@/components/Nav";
import AiQueryWidget from "@/components/AiQueryWidget";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

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
      <body className={`${inter.variable} ${playfair.variable} ${inter.className} relative`}>
        <AuthSessionProvider>
          <Nav />
          <div className="relative z-10">{children}</div>
          <AiQueryWidget />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
