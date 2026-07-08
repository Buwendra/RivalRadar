# Kironyx Frontend

Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui. Deployed via AWS Amplify on push to `main`.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
npm run lint         # ESLint (this one is the real linter, unlike Backend's)
npm run build        # production build (output: standalone)
```

## Environment

Three `NEXT_PUBLIC_*` variables. Inlined at build time, so any change in Amplify console requires a rebuild before it takes effect:

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend HTTP API origin, e.g. `https://6xjghxskzd.execute-api.us-east-1.amazonaws.com` |
| `NEXT_PUBLIC_APP_NAME` | Display name (currently `Kironyx`) |
| `NEXT_PUBLIC_APP_URL` | Public URL of the deployed frontend (used in some email/share links) |

Set these in Amplify console (App settings → Environment variables). After changing, trigger a manual rebuild:

```bash
aws amplify start-job --app-id d1zrq9gf129s9u --branch-name main --job-type RELEASE
```

## Project layout

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # sign-in, sign-up
│   ├── (dashboard)/       # authenticated routes — main app surface
│   ├── (public)/          # public legal / cancellation / accept-invite
│   └── onboarding/
├── components/
│   ├── dashboard/         # feature components (research-card, brand-pulse, share-of-voice…)
│   ├── layout/            # auth-guard, sidebar, header
│   ├── shared/            # cross-feature shared (page-header, error-alert, loaders)
│   ├── settings/          # account / workspace / integration settings
│   └── ui/                # shadcn/ui primitives
└── lib/
    ├── api/               # apiClient + per-resource domain modules
    ├── auth/              # AuthProvider, token-storage
    ├── hooks/             # TanStack Query wrappers (use-{resource})
    ├── providers/         # app-providers (Query client config, theme)
    ├── types/             # mirror of Backend types — keep in sync manually
    └── utils/             # constants, format helpers, capability mirror
```

## Data flow

API calls: `lib/api/client.ts` (`apiClient<T>`) → domain modules (`lib/api/{resource}.ts`) → TanStack Query hooks (`lib/hooks/use-{resource}.ts`) → components.

Auth tokens stored in `localStorage` with `rs_` prefix. `apiClient` auto-injects the **ID token** (not the access token — backend reads the `email` claim which only appears on ID tokens) when `requireAuth: true` (default). A 401 on an authenticated call clears tokens and redirects to `/sign-in`; a 401 on a `requireAuth: false` call (sign-in itself, public token routes) is passed through so the page can render the real error.

Global query config: `staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false` (set in `lib/providers/app-providers.tsx`).

## Where to look first

- **Adding a route**: `src/app/(dashboard)/dashboard/<your-route>/page.tsx` — wraps in `AuthGuard` automatically via the layout.
- **Adding an API call**: new method in `src/lib/api/<resource>.ts` + matching hook in `src/lib/hooks/use-<resource>.ts`. Mirror the response type from the Backend in `src/lib/types/`.
- **Adding a feature flag / capability**: update both `src/lib/utils/capabilities.ts` AND `Backend/src/shared/types/capabilities.ts` — they don't share a runtime, only an intent.

## Related docs

- [/CLAUDE.md](../CLAUDE.md) — primary reference for the whole codebase (Claude Code uses this).
- [/PRODUCT_OVERVIEW.md](../PRODUCT_OVERVIEW.md) — product narrative.
- [/docs/README.md](../docs/README.md) — full documentation index.
