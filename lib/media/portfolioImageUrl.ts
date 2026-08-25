import type {
  Artwork,
} from "@/data/portfolio/types";

const mediaUrl =
  process.env.NEXT_PUBLIC_MEDIA_URL;

function getMediaUrl() {
  if (!mediaUrl) {
    throw new Error(
      "NEXT_PUBLIC_MEDIA_URL environment variable is not configured"
    );
  }

  return mediaUrl.replace(
    /\/+$/,
    ""
  );
}

/*
 * ============================================================
 * ORIGINAL / MASTER
 * ============================================================
 */

export function getPortfolioMasterUrl(
  artwork: Artwork
) {
  if (!artwork.storageKey) {
    return artwork.src;
  }

  return `${getMediaUrl()}/${artwork.storageKey}`;
}

/*
 * ============================================================
 * GALLERY THUMBNAIL
 * ============================================================
 */

export function getPortfolioThumbnailUrl(
  artwork: Artwork
) {
  if (!artwork.storageKey) {
    return artwork.src;
  }

  const focusX =
    (artwork.thumbnailFocusX ?? 50) /
    100;

  const focusY =
    (artwork.thumbnailFocusY ?? 50) /
    100;

  return (
    `${getMediaUrl()}` +
    `/cdn-cgi/image/` +
    `width=800,` +
    `height=1000,` +
    `fit=cover,` +
    `gravity=${focusX}x${focusY},` +
    `format=auto/` +
    artwork.storageKey
  );
}

/*
 * ============================================================
 * LIGHTBOX DISPLAY
 * ============================================================
 */

export function getPortfolioDisplayUrl(
  artwork: Artwork
) {
  if (!artwork.storageKey) {
    return artwork.src;
  }

  return (
    `${getMediaUrl()}` +
    `/cdn-cgi/image/` +
    `width=1800,` +
    `fit=scale-down,` +
    `format=auto/` +
    artwork.storageKey
  );
}