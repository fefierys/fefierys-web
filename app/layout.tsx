import type { Metadata } from "next";
import "./globals.css";
import { Lexend } from "next/font/google";

import NavbarServer from '@/components/NavbarServer';
import Footer from "@/components/Footer";
import Background from "@/components/Background";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-lexend",
});

const isQa = process.env.NEXT_PUBLIC_APP_ENV === "qa";

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

  robots: isQa
    ? {
        index: false,
        follow: false,

        googleBot: {
          index: false,
          follow: false,
        },
      }
    : {
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

        {isQa && (
          <div
            className="
              pointer-events-none fixed left-1/2 top-2 z-[9999]
              -translate-x-1/2 rounded-full
              border border-amber-300/40 bg-black/80
              px-4 py-1.5 text-xs font-semibold
              tracking-[0.18em] text-amber-200
              shadow-lg backdrop-blur-md
            "
          >
            QA ENVIRONMENT
          </div>
        )}

        <NavbarServer />

        {children}

        <Analytics />

        <SpeedInsights />

        <Footer />
      </body>
    </html>
  );
}