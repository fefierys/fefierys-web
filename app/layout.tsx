import type { Metadata } from "next";
import "./globals.css";
import { Lexend } from "next/font/google"

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Background from "@/components/Background";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});


export const metadata: Metadata = {
  title: "Fefierys | Fantasy Illustrator & Digital Artist",
  description:
    "Official portfolio of Fefierys, showcasing fantasy illustrations, semi-realistic artwork, book covers, and commissioned art.",

  openGraph: {
    title: "Fefierys | Fantasy Illustrator & Digital Artist",
    description:
      "Fantasy illustrations, semi-realistic artwork, book covers, and commissioned art.",
    url: "https://fefierys.com",
    siteName: "Fefierys",
    images: [
      {
        url: "https://fefierys.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Fefierys Fantasy Art Portfolio",
      },
    ],
    locale: "en_US",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Fefierys | Fantasy Illustrator & Digital Artist",
    description:
      "Fantasy illustrations, semi-realistic artwork, book covers, and commissions art.",
    images: ["https://fefierys.com/og-image.jpg"],
  },
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
        <Analytics />
        <SpeedInsights />
        <Footer />
      </body>
    </html>
  );
}