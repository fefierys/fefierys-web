"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

function shouldExcludeUrl(url: string): boolean {
  const pathname = new URL(url, window.location.origin).pathname;

  return pathname === "/quote" || pathname.startsWith("/quote/");
}

export default function SiteObservability() {
  return (
    <>
      <Analytics
        beforeSend={(event) => {
          if (shouldExcludeUrl(event.url)) {
            return null;
          }

          return event;
        }}
      />

      <SpeedInsights
        beforeSend={(event) => {
          if (shouldExcludeUrl(event.url)) {
            return null;
          }

          return event;
        }}
      />
    </>
  );
}