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

function clampFocus(
  value:
    | number
    | undefined
) {
  return Math.min(
    100,
    Math.max(
      0,
      value ?? 50
    )
  );
}

/*
 * ============================================================
 * ORIGINAL / WEB MASTER
 * ============================================================
 */

export function getPortfolioMasterUrl(
  artwork: Artwork
) {
  if (!artwork.storageKey) {
    return artwork.src;
  }

  return (
    `${getMediaUrl()}/` +
    artwork.storageKey
  );
}

/*
 * ============================================================
 * GALLERY THUMBNAIL
 * ============================================================
 */

export type PortfolioThumbnailWidth =
  | 400
  | 640
  | 736
  | 800
  | 1200;

export function getPortfolioThumbnailUrl(
  artwork: Artwork,
  width:
    PortfolioThumbnailWidth =
      800
) {
  if (!artwork.storageKey) {
    return artwork.src;
  }

  const focusX =
    clampFocus(
      artwork.thumbnailFocusX
    ) / 100;

  const focusY =
    clampFocus(
      artwork.thumbnailFocusY
    ) / 100;

  return (
    `${getMediaUrl()}` +
    `/thumb/` +
    artwork.storageKey +
    `?w=${width}` +
    `&x=${focusX}` +
    `&y=${focusY}` +
    `&v=2`
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
    `/display/` +
    artwork.storageKey
  );
}