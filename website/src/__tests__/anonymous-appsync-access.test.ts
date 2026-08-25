/**
 * Anonymous (guest) AppSync Access Tests — live integration
 *
 * The public leaderboard and overlay apps do NOT use API keys. They
 * authenticate as the CwRum Cognito Identity Pool *unauthenticated* (guest)
 * IAM role (allowUnauthenticatedIdentities: true, defaultAuthMode: 'iam').
 * AppSync IAM auth is deny-by-default, so an anonymous visitor can only reach
 * the handful of fields the guest role is explicitly granted (getLeaderboard +
 * the leaderboard/overlay subscriptions).
 *
 * This test drives the LIVE endpoint exactly like the leaderboard app does
 * (Amplify v6 `generateClient` with IAM/guest auth) and proves that:
 *   1. The guest can reach the public getLeaderboard field (positive control).
 *   2. The guest is DENIED on authenticated-only fields (getAllModels,
 *      getAllFleets) — i.e. anonymous users cannot read the rest of the API.
 *
 * Runs in the post-deploy pipeline stage against the deployed backend.
 *
 * Configuration (env var overrides, else falls back to the leaderboard's
 * generated config.json):
 *   DREM_APPSYNC_ENDPOINT        — AppSync GraphQL endpoint URL
 *   DREM_APPSYNC_REGION          — AWS region of the API
 *   DREM_GUEST_IDENTITY_POOL_ID  — Cognito Identity Pool with guest access
 */

import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/api';
import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';

import { getAllFleets, getAllModels, getLeaderboard } from '../graphql/queries';

// ---------------------------------------------------------------------------
// Config resolution — env vars win, otherwise read the leaderboard app config
// that `make local.config` / the pipeline generates.
// ---------------------------------------------------------------------------

interface LeaderboardConfig {
  Auth: { identityPoolId: string };
  API: { aws_appsync_graphqlEndpoint: string; aws_appsync_region: string };
}

function resolveConfig(): { endpoint: string; region: string; identityPoolId: string } | null {
  let fromFile: Partial<LeaderboardConfig> = {};
  try {
    const configPath = join(__dirname, '..', '..', 'leaderboard', 'src', 'config.json');
    fromFile = JSON.parse(readFileSync(configPath, 'utf-8')) as LeaderboardConfig;
  } catch {
    // No generated config on disk — rely purely on env vars.
  }

  const endpoint = process.env.DREM_APPSYNC_ENDPOINT ?? fromFile.API?.aws_appsync_graphqlEndpoint;
  const region = process.env.DREM_APPSYNC_REGION ?? fromFile.API?.aws_appsync_region;
  const identityPoolId = process.env.DREM_GUEST_IDENTITY_POOL_ID ?? fromFile.Auth?.identityPoolId;

  if (!endpoint || !region || !identityPoolId) return null;
  return { endpoint, region, identityPoolId };
}

// ---------------------------------------------------------------------------
// Error classification — did AppSync deny the call on authorization grounds?
// ---------------------------------------------------------------------------

function errorText(err: unknown): string {
  const parts: string[] = [];
  const e = err as Record<string, unknown> | null | undefined;
  if (e == null) return '';
  if (typeof e === 'string') parts.push(e);
  if (typeof e.message === 'string') parts.push(e.message);
  if (e.errors) {
    try {
      parts.push(JSON.stringify(e.errors));
    } catch {
      /* ignore */
    }
  }
  try {
    parts.push(JSON.stringify(e));
  } catch {
    /* ignore */
  }
  parts.push(String(err));
  return parts.join(' | ').toLowerCase();
}

/** AppSync returns HTTP 401 / UnauthorizedException when IAM denies the field. */
function isAuthDenied(err: unknown): boolean {
  const text = errorText(err);
  return text.includes('unauthorized') || text.includes('not authorized');
}

// Avoid ReturnType<typeof generateClient> which triggers TS2321 (excessive stack depth)
// due to Amplify v6's deeply-nested conditional types. `graphql` returns Promise for
// queries/mutations and Observable for subscriptions, so we type the return as `unknown`.
interface AmplifyClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphql(options: { query: string; variables?: Record<string, unknown> }): any;
}

/** Run a query and normalise the outcome to a discriminated result. */
async function attempt(
  client: AmplifyClient,
  query: string,
  variables?: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; err: unknown }> {
  try {
    const data = await client.graphql({ query, variables });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, err };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const config = resolveConfig();

describe.skipIf(!config)('Anonymous (guest) AppSync access', () => {
  let client: AmplifyClient;

  beforeAll(() => {
    // Mirror the leaderboard app's Amplify setup: guest identity pool + IAM.
    Amplify.configure({
      Auth: {
        Cognito: {
          identityPoolId: config!.identityPoolId,
          allowGuestAccess: true,
        },
      },
      API: {
        GraphQL: {
          endpoint: config!.endpoint,
          region: config!.region,
          defaultAuthMode: 'iam',
        },
      },
    });
    client = generateClient() as unknown as AmplifyClient;
  });

  it('config for the guest identity pool + endpoint is available', () => {
    expect(config).not.toBeNull();
  });

  it('guest CAN reach the public getLeaderboard field (positive control)', async () => {
    // A non-existent eventId is fine — we only care that the call is NOT
    // rejected on authorization grounds. It should resolve (empty/null data),
    // never a 401/UnauthorizedException.
    const result = await attempt(client, getLeaderboard, {
      eventId: '00000000-0000-0000-0000-000000000000',
    });

    if (!result.ok) {
      expect(
        isAuthDenied(result.err),
        `getLeaderboard must NOT be auth-denied for guests, got: ${errorText(result.err)}`
      ).toBe(false);
    }
  });

  it('guest is DENIED on getAllModels (cannot read models)', async () => {
    const result = await attempt(client, getAllModels);

    expect(
      result.ok,
      `SECURITY: anonymous getAllModels must be denied but it succeeded: ${JSON.stringify(
        result.ok ? result.data : {}
      )}`
    ).toBe(false);
    expect(
      isAuthDenied((result as { err: unknown }).err),
      `expected an authorization denial, got: ${errorText((result as { err: unknown }).err)}`
    ).toBe(true);
  });

  it('guest is DENIED on getAllFleets (cannot read fleets)', async () => {
    const result = await attempt(client, getAllFleets);

    expect(
      result.ok,
      `SECURITY: anonymous getAllFleets must be denied but it succeeded: ${JSON.stringify(
        result.ok ? result.data : {}
      )}`
    ).toBe(false);
    expect(
      isAuthDenied((result as { err: unknown }).err),
      `expected an authorization denial, got: ${errorText((result as { err: unknown }).err)}`
    ).toBe(true);
  });
});
