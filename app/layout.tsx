import type { Metadata } from "next";
import "./globals.css";
import { Lexend } from "next/font/google";

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
  metadataBase: new URL("https://fefierys.com"),

  title: {
    default: "Fefierys | Fantasy Illustrator & Digital Artist",
    template: "%s | Fefierys",
  },

  description:
    "Official portfolio of Fefierys, featuring fantasy illustration, semi-realistic and stylized artwork, book covers, character art, chibis, emotes, and custom commissions.",

  openGraph: {
    title: "Fefierys | Fantasy Illustrator & Digital Artist",
    description:
      "Fantasy illustration portfolio featuring semi-realistic and stylized artwork, book covers, character art, chibis, emotes, and custom commissions.",
    url: "/",
    siteName: "Fefierys",
    images: [
      {
        url: "/og-image.jpg",
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
      "Fantasy illustration portfolio featuring semi-realistic and stylized artwork, book covers, character art, chibis, emotes, and custom commissions.",
    images: ["/og-image.jpg"],
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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