import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    deviceSizes: [
      640,
      750,
      828,
      1080,
      1200,
      1920,
      2048,
      3840,
    ],
    imageSizes: [
      32,
      48,
      64,
      96,
      128,
      256,
      384,
      420,
      480,
      560,
    ],
    qualities: [60, 75],
  },

  async headers() {
    return [
      {
        source: "/quote/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, max-age=0, must-revalidate",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
};

export default nextConfig;