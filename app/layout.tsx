import type { Metadata } from "next";
import "./globals.css";
import { Lexend } from "next/font/google"

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Background from "@/components/Background";

import { Analytics } from "@vercel/analytics/react";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});


export const metadata: Metadata = {
  title: "Fefierys Art",
  description: "Digital artist portfolio",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={`${lexend.variable} font-lexend`}>

        <Background />

        <Navbar />

        {children}

        <Footer />

        <Analytics />

      </body>
    </html>
  );
}