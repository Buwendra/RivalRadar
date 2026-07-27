/** @type {import('next').NextConfig} */

// Security headers per OWASP web hardening guidance. CSP is enforced; the
// allowlist below covers every external resource the app actually loads
// (Paddle checkout iframes + the API origin). Fonts are bundled via
// `next/font/local`; there are no third-party CDNs to allow.
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://*.execute-api.us-east-1.amazonaws.com";
const cspDirectives = [
  "default-src 'self'",
  // Next.js hydration + dev-mode inline scripts. Tighten with nonces later.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl} https://api.paddle.com https://*.paddle.com`,
  // Paddle checkout iframes
  "frame-src 'self' https://*.paddle.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // HSTS — forces HTTPS for two years; preload after 6 months of clean
  // delivery if you want the browser-list inclusion.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Structured-header syntax: allowlist origins must be double-quoted and
    // cannot use wildcards. The previous `payment=(self 'https://*.paddle.com')`
    // was invalid, so browsers dropped the ENTIRE policy (every restriction
    // below silently lost). Payment is delegated to Paddle's exact checkout
    // origins instead.
    key: "Permissions-Policy",
    value:
      'camera=(), microphone=(), geolocation=(), payment=(self "https://buy.paddle.com" "https://sandbox-buy.paddle.com"), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        // Apply on every route
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
