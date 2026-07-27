/**
 * Funnel state for the public marketing surface.
 *
 * The product is pre-launch and invite-only: self-signup is closed on the
 * backend, so every marketing CTA routes to the Request Access capture flow
 * rather than an open registration form. Flip `NEXT_PUBLIC_SIGNUP_ENABLED` to
 * `"true"` (and re-enable the backend signup path) to return to a self-serve
 * funnel — CTAs then point at /sign-up with their open-state labels.
 *
 * NEXT_PUBLIC_* is inlined at build time; changing it in the host needs a
 * rebuild to take effect.
 */
export const SIGNUP_ENABLED =
  process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "true";

/** Where every primary CTA points, depending on funnel state. */
export const PRIMARY_CTA_HREF = SIGNUP_ENABLED ? "/sign-up" : "/contact";

/**
 * Primary CTA label. Pass the open-funnel label; when signup is closed it is
 * replaced by "Request access" everywhere for one coherent voice.
 */
export function primaryCtaLabel(openLabel: string): string {
  return SIGNUP_ENABLED ? openLabel : "Request access";
}
