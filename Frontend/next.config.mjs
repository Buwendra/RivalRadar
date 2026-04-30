/** @type {import('next').NextConfig} */

// Security headers per OWASP web hardening guidance.
// CSP starts in report-only mode so we can verify nothing breaks; once
// stable for 2 weeks, switch the header name to `Content-Security-Policy`
// (without `-Report-Only`) to enforce.
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
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(self 'https://*.paddle.com'), usb=(), magnetometer=(), gyroscope=(), accelerometer=()",
  },
  // Report-only for first 2 weeks; flip to `Content-Security-Policy` once
  // verified that no legitimate flow is blocked.
  { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
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
