import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import AskOwnique from "@/components/AskOwnique";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ownique — One design. One owner. Credit forever.",
  description: "A marketplace where every design is sold exactly once.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} antialiased`}>
        <WalletProvider>
          <div className="print:hidden"><Navbar /></div>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
          <div className="print:hidden"><AskOwnique /></div>
        </WalletProvider>
      </body>
    </html>
  );
}
