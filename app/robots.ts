import type { MetadataRoute } from "next";

const isQa = process.env.NEXT_PUBLIC_APP_ENV === "qa";

export default function robots(): MetadataRoute.Robots {
  if (isQa) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },

    sitemap: "https://fefierys.com/sitemap.xml",
  };
}