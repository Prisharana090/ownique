import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import AskOwnique from "@/components/AskOwnique";
import Footer from "@/components/Footer";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ownique — One design. One owner. Credit forever.",
  description: "A marketplace where every design is sold exactly once.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} ${playfair.variable} antialiased`}>
        <WalletProvider>
          <div className="print:hidden"><Navbar /></div>
          <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
          <div className="print:hidden"><Footer /></div>
          <div className="print:hidden"><AskOwnique /></div>
        </WalletProvider>
      </body>
    </html>
  );
}
