/**
 * Router ↔ manifest consistency test.
 *
 * Routers deliberately do NOT import route-manifest.ts (they'd drag every
 * handler into one dependency graph); each declares its routeKeys literally.
 * This test is the contract that keeps the two in agreement: a route present
 * in one but not the other is a 404 in production, caught here instead.
 *
 * Importing every router also import-loads all ~80 handler modules — which
 * doubles as a smoke test that no handler throws at module scope when
 * co-bundled (the routers' static imports execute exactly like a cold start).
 */
import { describe, expect, it } from 'vitest';
import { FNS, ROUTES, FnId } from '../route-manifest';
import * as authSignup from './auth-signup';
import * as authSignin from './auth-signin';
import * as authRefresh from './auth-refresh';
import * as users from './users';
import * as userDelete from './user-delete';
import * as researchTriggers from './research-triggers';
import * as researchRuns from './research-runs';
import * as researchRunsDetails from './research-runs-details';
import * as competitors from './competitors';
import * as brand from './brand';
import * as changes from './changes';
import * as workspaces from './workspaces';
import * as views from './views';
import * as integrations from './integrations';
import * as subscriptions from './subscriptions';
import * as paddleWebhook from './paddle-webhook';
import * as publicShare from './public-share';
import * as v1 from './v1';
import * as pdf from './pdf';
import * as admin from './admin';

// Record<FnId, …> makes a missing router a compile error, not a test failure.
const ROUTERS: Record<FnId, { routes: Record<string, unknown>; handler: unknown }> = {
  AuthSignup: authSignup,
  AuthSignin: authSignin,
  AuthRefresh: authRefresh,
  Users: users,
  UserDelete: userDelete,
  ResearchTriggers: researchTriggers,
  ResearchRuns: researchRuns,
  ResearchRunsDetails: researchRunsDetails,
  Competitors: competitors,
  Brand: brand,
  Changes: changes,
  Workspaces: workspaces,
  Views: views,
  Integrations: integrations,
  Subscriptions: subscriptions,
  PaddleWebhook: paddleWebhook,
  PublicShare: publicShare,
  V1: v1,
  Pdf: pdf,
  Admin: admin,
};

const FN_IDS = Object.keys(FNS) as FnId[];

describe('route manifest', () => {
  it('has globally unique routeKeys', () => {
    const keys = ROUTES.map((r) => r.routeKey);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it('covers all 84 routes', () => {
    expect(ROUTES).toHaveLength(84);
  });

  it('assigns every route to a declared function', () => {
    for (const route of ROUTES) {
      expect(FN_IDS, `unknown fn '${route.fn}' on ${route.routeKey}`).toContain(route.fn);
    }
  });

  it('leaves no function without routes', () => {
    for (const fnId of FN_IDS) {
      const count = ROUTES.filter((r) => r.fn === fnId).length;
      expect(count, `${fnId} has no routes`).toBeGreaterThan(0);
    }
  });
});

describe('router dispatch tables match the manifest', () => {
  for (const fnId of FN_IDS) {
    it(`${fnId}: table set-equals its manifest routes`, () => {
      const expected = ROUTES.filter((r) => r.fn === fnId)
        .map((r) => r.routeKey)
        .sort();
      const actual = Object.keys(ROUTERS[fnId].routes).sort();
      expect(actual).toEqual(expected);
    });

    it(`${fnId}: every table entry is a handler function`, () => {
      for (const [key, value] of Object.entries(ROUTERS[fnId].routes)) {
        expect(typeof value, `${fnId} → ${key}`).toBe('function');
      }
      expect(typeof ROUTERS[fnId].handler).toBe('function');
    });
  }
});

describe('routing safety invariants', () => {
  it('public routes never share a function with jwt routes (except by explicit design)', () => {
    // Mixing auth modes in one function is allowed only where the manifest
    // deliberately groups self-authenticating public routes (V1's X-API-Key,
    // PublicShare's tokens, PaddleWebhook's signature, the auth endpoints).
    // A jwt route landing in one of those functions — or a public route
    // landing in a jwt function — is a grouping mistake.
    for (const fnId of FN_IDS) {
      const auths = new Set(ROUTES.filter((r) => r.fn === fnId).map((r) => r.auth));
      expect(auths.size, `${fnId} mixes jwt and public routes`).toBe(1);
    }
  });

  it('elevated-grant functions hold no public routes', () => {
    for (const fnId of FN_IDS) {
      const def = FNS[fnId];
      const hasElevated = (def.grants ?? []).some((g) => g !== 'sesSend');
      if (!hasElevated) continue;
      const publicRoutes = ROUTES.filter((r) => r.fn === fnId && r.auth === 'public');
      expect(publicRoutes, `${fnId} has elevated IAM and public routes`).toEqual([]);
    }
  });
});
