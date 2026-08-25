const PORTFOLIO_PREFIX =
  "portfolio/artworks/";

const CACHE_CONTROL =
  "public, max-age=3600";

const ALLOWED_THUMBNAIL_WIDTHS =
  new Set([
    400,
    640,
    736,
    800,
    1200,
  ]);

const DEFAULT_THUMBNAIL_WIDTH =
  800;

const THUMBNAIL_VERSION =
  "2";

/*
 * ============================================================
 * THUMBNAIL WIDTH
 * ============================================================
 */

function getThumbnailWidth(
  value
) {
  if (
    value === null ||
    value.trim() === ""
  ) {
    return DEFAULT_THUMBNAIL_WIDTH;
  }

  const width =
    Number(value);

  if (
    !Number.isInteger(width) ||
    !ALLOWED_THUMBNAIL_WIDTHS.has(
      width
    )
  ) {
    return null;
  }

  return width;
}

/*
 * ============================================================
 * OUTPUT FORMAT
 * ============================================================
 */

function getOutputFormat(
  request
) {
  const accept =
    request.headers.get(
      "Accept"
    ) ?? "";

  if (
    accept.includes(
      "image/avif"
    )
  ) {
    return "image/avif";
  }

  if (
    accept.includes(
      "image/webp"
    )
  ) {
    return "image/webp";
  }

  return "image/jpeg";
}

/*
 * ============================================================
 * FOCAL POINT
 * ============================================================
 */

function getFocusValue(
  value
) {
  if (
    value === null ||
    value.trim() === ""
  ) {
    return 0.5;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0.5;
  }

  return Math.min(
    1,
    Math.max(
      0,
      number
    )
  );
}

/*
 * ============================================================
 * STORAGE KEY
 * ============================================================
 */

function getStorageKey(
  pathname,
  routePrefix
) {
  const rawKey =
    pathname.slice(
      routePrefix.length
    );

  if (!rawKey) {
    return null;
  }

  const key =
    decodeURIComponent(
      rawKey
    );

  /*
   * Do not expose arbitrary objects
   * from the bucket.
   */

  if (
    !key.startsWith(
      PORTFOLIO_PREFIX
    )
  ) {
    return null;
  }

  return key;
}

/*
 * ============================================================
 * CACHE KEY
 * ============================================================
 */

function createCacheKey({
  request,
  format,
  focusX = undefined,
  focusY = undefined,
  width = undefined,
  version = "1",
}) {
  const url =
    new URL(
      request.url
    );

  /*
   * Rebuild query parameters in a
   * deterministic order.
   */

  url.search = "";

  url.searchParams.set(
    "v",
    version
  );

  url.searchParams.set(
    "format",
    format
  );

  if (
    width !== undefined
  ) {
    url.searchParams.set(
      "w",
      String(width)
    );
  }

  if (
    focusX !== undefined &&
    focusY !== undefined
  ) {
    url.searchParams.set(
      "x",
      focusX.toFixed(4)
    );

    url.searchParams.set(
      "y",
      focusY.toFixed(4)
    );
  }

  return new Request(
    url.toString(),
    {
      method: "GET",
    }
  );
}

/*
 * ============================================================
 * THUMBNAIL
 * ============================================================
 */

async function serveThumbnail(
  request,
  env,
  ctx,
  key
) {
  const url =
    new URL(
      request.url
    );

  const width =
    getThumbnailWidth(
      url.searchParams.get(
        "w"
      )
    );

  if (width === null) {
    return new Response(
      "Invalid thumbnail width",
      {
        status: 400,
      }
    );
  }

  /*
   * Portfolio thumbnails are always 4:5.
   */

  const height =
    Math.round(
      width * 1.25
    );

  const focusX =
    getFocusValue(
      url.searchParams.get(
        "x"
      )
    );

  const focusY =
    getFocusValue(
      url.searchParams.get(
        "y"
      )
    );

  const format =
    getOutputFormat(
      request
    );

  const cache =
    caches.default;

  const cacheKey =
    createCacheKey({
      request,
      format,
      focusX,
      focusY,
      width,
      version:
        THUMBNAIL_VERSION,
    });

  const cached =
    await cache.match(
      cacheKey
    );

  if (cached) {
    return cached;
  }

  /*
   * Read master directly from R2.
   */

  const object =
    await env
      .PORTFOLIO_BUCKET
      .get(
        key
      );

  if (!object) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  /*
   * Transform R2 bytes directly through
   * the Images binding.
   */

  const transformed =
    (
      await env.IMAGES
        .input(
          object.body
        )
        .transform({
          width,
          height,
          fit: "cover",

          gravity: {
            x: focusX,
            y: focusY,
          },
        })
        .output({
          format,
          quality: 75,
        })
    ).response();

  const headers =
    new Headers(
      transformed.headers
    );

  headers.set(
    "Cache-Control",
    CACHE_CONTROL
  );

  headers.set(
    "Vary",
    "Accept"
  );

  const response =
    new Response(
      transformed.body,
      {
        status:
          transformed.status,

        headers,
      }
    );

  /*
   * Store transformed response in the
   * Cloudflare Worker cache.
   */

  if (transformed.ok) {
    ctx.waitUntil(
      cache.put(
        cacheKey,
        response.clone()
      )
    );
  }

  return response;
}

/*
 * ============================================================
 * DISPLAY / LIGHTBOX
 * ============================================================
 */

async function serveDisplay(
  request,
  env,
  ctx,
  key
) {
  const format =
    getOutputFormat(
      request
    );

  const cache =
    caches.default;

  const cacheKey =
    createCacheKey({
      request,
      format,
    });

  const cached =
    await cache.match(
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const object =
    await env
      .PORTFOLIO_BUCKET
      .get(
        key
      );

  if (!object) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  const transformed =
    (
      await env.IMAGES
        .input(
          object.body
        )
        .transform({
          width: 1800,
          fit: "scale-down",
        })
        .output({
          format,
          quality: 85,
        })
    ).response();

  const headers =
    new Headers(
      transformed.headers
    );

  headers.set(
    "Cache-Control",
    CACHE_CONTROL
  );

  headers.set(
    "Vary",
    "Accept"
  );

  const response =
    new Response(
      transformed.body,
      {
        status:
          transformed.status,

        headers,
      }
    );

  if (transformed.ok) {
    ctx.waitUntil(
      cache.put(
        cacheKey,
        response.clone()
      )
    );
  }

  return response;
}

/*
 * ============================================================
 * RAW R2 FALLBACK
 * ============================================================
 *
 * Kept temporarily so direct master URLs
 * continue working during the migration.
 */

async function serveRawObject(
  env,
  key
) {
  if (
    !key.startsWith(
      PORTFOLIO_PREFIX
    )
  ) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  const object =
    await env
      .PORTFOLIO_BUCKET
      .get(
        key
      );

  if (!object) {
    return new Response(
      "Not found",
      {
        status: 404,
      }
    );
  }

  const headers =
    new Headers();

  object.writeHttpMetadata(
    headers
  );

  if (
    object.httpEtag
  ) {
    headers.set(
      "ETag",
      object.httpEtag
    );
  }

  headers.set(
    "Cache-Control",
    CACHE_CONTROL
  );

  return new Response(
    object.body,
    {
      headers,
    }
  );
}

/*
 * ============================================================
 * WORKER
 * ============================================================
 */

export default {
  async fetch(
    request,
    env,
    ctx
  ) {
    try {
      if (
        request.method !==
        "GET"
      ) {
        return new Response(
          "Method not allowed",
          {
            status: 405,

            headers: {
              Allow: "GET",
            },
          }
        );
      }

      const url =
        new URL(
          request.url
        );

      /*
       * ========================================================
       * THUMBNAIL
       * ========================================================
       */

      const thumbnailPrefix =
        "/thumb/";

      if (
        url.pathname.startsWith(
          thumbnailPrefix
        )
      ) {
        const key =
          getStorageKey(
            url.pathname,
            thumbnailPrefix
          );

        if (!key) {
          return new Response(
            "Invalid object key",
            {
              status: 400,
            }
          );
        }

        return serveThumbnail(
          request,
          env,
          ctx,
          key
        );
      }

      /*
       * ========================================================
       * DISPLAY / LIGHTBOX
       * ========================================================
       */

      const displayPrefix =
        "/display/";

      if (
        url.pathname.startsWith(
          displayPrefix
        )
      ) {
        const key =
          getStorageKey(
            url.pathname,
            displayPrefix
          );

        if (!key) {
          return new Response(
            "Invalid object key",
            {
              status: 400,
            }
          );
        }

        return serveDisplay(
          request,
          env,
          ctx,
          key
        );
      }

      /*
       * ========================================================
       * RAW OBJECT
       * ========================================================
       */

      const rawKey =
        decodeURIComponent(
          url.pathname.replace(
            /^\/+/,
            ""
          )
        );

      if (!rawKey) {
        return new Response(
          "Missing object key",
          {
            status: 400,
          }
        );
      }

      return serveRawObject(
        env,
        rawKey
      );
    } catch (error) {
      console.error(
        "Media Worker error:",
        error
      );

      return new Response(
        "Image processing failed",
        {
          status: 500,
        }
      );
    }
  },
};