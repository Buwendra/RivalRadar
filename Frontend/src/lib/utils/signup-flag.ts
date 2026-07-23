/**
 * Pre-launch signup kill switch — frontend mirror of the backend's
 * SIGNUP_ENABLED env gate (the backend + Cognito remain the enforcement
 * source of truth; this only controls what the UI shows).
 *
 * NEXT_PUBLIC_* vars are inlined at build time — toggling in Amplify
 * requires a rebuild before it takes effect.
 */
export const SIGNUP_ENABLED = process.env.NEXT_PUBLIC_SIGNUP_ENABLED === "true";

/** Where signup CTAs point while sign-ups are closed. */
export const SIGNUP_CTA_HREF = SIGNUP_ENABLED ? "/sign-up" : "/contact";

/** Marketing CTA label — the open-state label, or "Request Access" while closed. */
export const signupCtaLabel = (openLabel: string) =>
  SIGNUP_ENABLED ? openLabel : "Request Access";
