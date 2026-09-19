import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS.
 *
 * Use ONLY from lib/server/** (ledger writes, idempotency, provider webhooks,
 * operator tooling). Never from a client component, never for anything that
 * should be scoped to the signed-in user without an explicit ownership check.
 *
 * `import "server-only"` makes the bundler fail loudly if this file is ever
 * pulled into client code.
 *
 * Accepts either key format Supabase issues:
 *   - legacy `service_role` JWT (eyJ…)
 *   - new secret key (sb_secret_…)
 */

let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Server-side ledger code needs it. " +
        "Get it from Supabase dashboard → Project Settings → API and add it to .env.local (never NEXT_PUBLIC_).",
    );
  }

  cached = createClient(url, key, {
    auth: {
      // No user session on this client — it is a machine identity.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { "x-lad-client": "server" },
    },
  });

  return cached;
}
