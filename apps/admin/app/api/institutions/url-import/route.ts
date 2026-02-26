import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/lib/permissions";
import * as cheerio from "cheerio";

/**
 * @api POST /api/institutions/url-import
 * @auth OPERATOR
 * @description Extract metadata (name, logo, colors) from a website URL
 *              for institution branding pre-fill.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth("OPERATOR");
  if (isAuthError(auth)) return auth.error;

  const body = await request.json().catch(() => null);
  const rawUrl = body?.url;

  if (!rawUrl || typeof rawUrl !== "string") {
    return NextResponse.json(
      { ok: false, error: "url is required" },
      { status: 400 }
    );
  }

  // Normalise URL
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid URL" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HumanFirstBot/1.0; +https://humanfirstfoundation.com)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: `Fetch failed: ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // ── Extract name ──────────────────────────────────
    const ogSiteName = $('meta[property="og:site_name"]').attr("content");
    const ogTitle = $('meta[property="og:title"]').attr("content");
    const titleTag = $("title").first().text();
    const rawName = ogSiteName || ogTitle || titleTag || "";
    // Clean common suffixes
    const name = rawName
      .replace(/\s*[-–|]\s*(Home|Homepage|Welcome|Main).*$/i, "")
      .replace(/\s*[-–|]\s*$/, "")
      .trim();

    // ── Extract logo ──────────────────────────────────
    // Prefer apple-touch-icon (high-res), then og:image, then favicon
    const appleTouchIcon =
      $('link[rel="apple-touch-icon"]').attr("href") ||
      $('link[rel="apple-touch-icon-precomposed"]').attr("href");
    const ogImage = $('meta[property="og:image"]').attr("content");
    const favicon =
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href");

    const rawLogo = appleTouchIcon || ogImage || favicon || "";
    const logoUrl = rawLogo ? resolveUrl(rawLogo, url) : "";

    // ── Extract primary color ─────────────────────────
    const themeColor =
      $('meta[name="theme-color"]').attr("content") ||
      $('meta[name="msapplication-TileColor"]').attr("content") ||
      $('meta[name="msapplication-navbutton-color"]').attr("content");

    const primaryColor = normalizeHex(themeColor || "") || "";

    // ── Derive secondary color ────────────────────────
    const secondaryColor = primaryColor
      ? deriveSecondaryColor(primaryColor)
      : "";

    // ── Extract description ───────────────────────────
    const ogDesc = $('meta[property="og:description"]').attr("content");
    const metaDesc = $('meta[name="description"]').attr("content");
    const description = (ogDesc || metaDesc || "").trim().slice(0, 300);

    return NextResponse.json({
      ok: true,
      meta: {
        name: name || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
        description: description || undefined,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Timed out fetching URL"
        : "Failed to fetch URL";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

// ── Helpers ──────────────────────────────────────────

/** Resolve a potentially relative URL against the base */
function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/** Normalize a CSS color string to a 7-char hex (#rrggbb) or empty string */
function normalizeHex(color: string): string {
  const trimmed = color.trim().toLowerCase();
  // Full hex
  if (/^#[0-9a-f]{6}$/.test(trimmed)) return trimmed;
  // Short hex
  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed.match(/^#(.)(.)(.)$/) || [];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "";
}

/** Derive a lighter secondary color from a hex primary (HSL shift) */
function deriveSecondaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d > 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  // Shift: reduce saturation by 10%, increase lightness by 15%
  const s2 = Math.max(0, Math.min(1, s - 0.1));
  const l2 = Math.max(0, Math.min(1, l + 0.15));

  return hslToHex(h, s2, l2);
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
