/**
 * Generates an SVG circular favicon for the browser tab.
 * Clips any uploaded business logo into a clean circle with a subtle contrasting ring.
 * Falls back to the default Emerald Green "GB" circular badge if no logo is uploaded.
 */

export function generateCircleFaviconSvg(logo?: string | null): string {
  const cleanLogo = typeof logo === "string" ? logo.trim() : "";

  if (cleanLogo) {
    // Escape quotes and XML entities in the logo source
    const safeHref = cleanLogo
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <defs>
    <clipPath id="circleClip">
      <circle cx="32" cy="32" r="29" />
    </clipPath>
  </defs>
  <!-- Contrasting white background circle with subtle emerald border for dark/light browser tabs -->
  <circle cx="32" cy="32" r="31" fill="#ffffff" stroke="#10b981" stroke-width="2" />
  <g clip-path="url(#circleClip)">
    <image href="${safeHref}" x="3" y="3" width="58" height="58" preserveAspectRatio="xMidYMid meet" />
  </g>
</svg>`;
  }

  // Default circular GB badge
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <circle cx="32" cy="32" r="31" fill="#059669" stroke="#047857" stroke-width="2" />
  <text x="32" y="40" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="800" fill="#ffffff" text-anchor="middle" letter-spacing="-0.5">GB</text>
</svg>`;
}

export function faviconDataUri(logo?: string | null): string {
  const svg = generateCircleFaviconSvg(logo);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
