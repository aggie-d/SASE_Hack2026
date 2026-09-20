import "server-only";

import { IDEMPOTENCY_HEADER, type IDEMPOTENT_ROUTES } from "@/lib/contracts";
import { createAdminClient } from "@/lib/supabase/admin";

import { ApiHttpError, ok, requestIdFrom, toErrorResponse } from "./http";

/**
 * Idempotency for monetary writes.
 *
 *   export const POST = route(async (req) => {
 *     const { userId } = await requireUser();
 *     const body = await parseBody(req, parseCreateDeposit);
 *     return withIdempotency(req, { userId, route: "POST /api/v1/deposits" }, body, async ({ operationId }) => {
 *       const deposit = await createDeposit({ userId, operationId, ...body });
 *       return { status: 202, body: deposit };
 *     });
 *   });
 *
 * Semantics (per user + route + Idempotency-Key):
 *   first request              → run handler, store { status, body }, return it
 *   same key, same body        → replay stored response (header Idempotent-Replayed: true)
 *   same key, different body   → 409 IDEMPOTENCY_CONFLICT
 *   same key, still running    → 409 IDEMPOTENCY_CONFLICT ("in progress")
 *   stored 5xx, or a run that
 *   died before storing        → re-run the handler with the SAME operationId
 *
 * The operationId is minted here, on first sight of the key, and persisted
 * before the handler runs. Every ledger write keyed on it (journals unique on
 * (operation_id, type); holds unique on (account_id, operation_id)) is
 * therefore safe to replay: a retry after a mid-flight crash cannot double-post.
 */

export type IdempotentRoute = (typeof IDEMPOTENT_ROUTES)[number];

export type IdempotentResult<T> = { status: number; body: T };

export type IdempotentHandler<T> = (ctx: { operationId: string; requestId: string }) => Promise<IdempotentResult<T>>;

/** A record whose handler started this long ago with no stored response is treated as dead. */
const IN_FLIGHT_TIMEOUT_MS = 60_000;

const MAX_KEY_LENGTH = 200;

type StoredResponse = { status: number; body: unknown };

type IdempotencyRow = {
  id: string;
  user_id: string;
  route: string;
  key: string;
  request_hash: string;
  operation_id: string;
  response: StoredResponse | null;
  created_at: string;
  updated_at: string;
};

// ─── Hashing (pure; unit-tested) ────────────────────────────────────────────

/** JSON with object keys sorted recursively, so key order never changes the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "bigint") return JSON.stringify(value.toString());
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return "[" + value.map(stableStringify).join(",") + "]";
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

/** sha256 hex of stableStringify(body). Web Crypto, so it works in any runtime. */
export async function hashBody(body: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(body));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read and validate the Idempotency-Key header. Throws 400 if absent or oversized. */
export function requireIdempotencyKey(req: Request): string {
  const key = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: `${IDEMPOTENCY_HEADER} header is required for this request.`,
      details: { header: IDEMPOTENCY_HEADER },
    });
  }
  if (key.length > MAX_KEY_LENGTH) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: `${IDEMPOTENCY_HEADER} must be at most ${MAX_KEY_LENGTH} characters.`,
    });
  }
  return key;
}

// ─── Core ───────────────────────────────────────────────────────────────────

export async function withIdempotency<T>(
  req: Request,
  scope: { userId: string; route: IdempotentRoute },
  body: unknown,
  handler: IdempotentHandler<T>,
): Promise<Response> {
  const requestId = requestIdFrom(req);
  const key = requireIdempotencyKey(req);
  const requestHash = await hashBody(body);
  const admin = createAdminClient();

  // 1. Claim the key. INSERT first so the operation_id is durable before any
  //    money moves. A unique violation means someone got here first.
  let record: IdempotencyRow;
  const inserted = await admin
    .from("idempotency_records")
    .insert({
      user_id: scope.userId,
      route: scope.route,
      key,
      request_hash: requestHash,
      operation_id: globalThis.crypto.randomUUID(),
      response: null,
    })
    .select("*")
    .single<IdempotencyRow>();

  if (inserted.error) {
    if (inserted.error.code !== "23505") throw inserted.error;

    const existing = await admin
      .from("idempotency_records")
      .select("*")
      .eq("user_id", scope.userId)
      .eq("route", scope.route)
      .eq("key", key)
      .single<IdempotencyRow>();
    if (existing.error) throw existing.error;
    record = existing.data;

    // 2. Same key, different payload → conflict. Never replay the wrong thing.
    if (record.request_hash !== requestHash) {
      throw new ApiHttpError("IDEMPOTENCY_CONFLICT");
    }

    // 3. Completed with a definitive answer → replay it verbatim.
    if (record.response && record.response.status < 500) {
      return ok(record.response.body, {
        status: record.response.status,
        requestId,
        headers: { "Idempotent-Replayed": "true" },
      });
    }

    // 4. Still running (recently claimed, no response yet) → tell the caller
    //    to retry shortly rather than running the handler twice in parallel.
    if (!record.response) {
      const ageMs = Date.now() - new Date(record.created_at).getTime();
      if (ageMs < IN_FLIGHT_TIMEOUT_MS) {
        throw new ApiHttpError("IDEMPOTENCY_CONFLICT", {
          message: "A request with this Idempotency-Key is still being processed. Retry shortly.",
        });
      }
    }
    // Otherwise: previous attempt died or ended in a 5xx → fall through and
    // re-run with the SAME operation_id. Ledger uniqueness makes this safe.
  } else {
    record = inserted.data;
  }

  // 5. Run the handler. Business failures (4xx) are stored and replayed like
  //    successes; 5xx is stored so the next retry re-executes.
  let result: StoredResponse;
  let response: Response;
  try {
    const r = await handler({ operationId: record.operation_id, requestId });
    result = { status: r.status, body: r.body };
    response = ok(r.body, { status: r.status, requestId });
  } catch (err) {
    response = toErrorResponse(err, requestId);
    result = { status: response.status, body: await response.clone().json() };
  }

  const stored = await admin
    .from("idempotency_records")
    .update({ response: result })
    .eq("id", record.id);
  if (stored.error) {
    // The operation itself succeeded; failing to persist the replay body must
    // not turn a completed transfer into an error for the caller.
    console.error(`[idempotency] ${requestId} failed to store response`, stored.error);
  }

  return response;
}
