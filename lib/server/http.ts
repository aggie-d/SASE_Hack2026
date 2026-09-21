import "server-only";

import type { NextRequest } from "next/server";

import type { ApiError, ErrorCode } from "@/lib/contracts";
import { ERROR_HTTP_STATUS, apiError } from "@/lib/contracts/errors";
import { MoneyError, parseMinorUnits, parsePositiveMinorUnits } from "@/lib/contracts/money";

/**
 * HTTP plumbing shared by every route under app/api/v1.
 *
 *   export const GET = route(async (req) => {
 *     const { userId } = await requireUser();
 *     return ok<WalletsResponse>({ wallets: await getWalletBalances(userId) });
 *   });
 *
 * Throw ApiHttpError anywhere below a route and the wrapper turns it into the
 * ApiError envelope with the right status. Unknown errors become 500
 * INTERNAL_ERROR and are logged with the request_id so they can be found.
 */

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ApiHttpError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, opts: { message?: string; details?: Record<string, unknown> } = {}) {
    super(opts.message ?? code);
    this.name = "ApiHttpError";
    this.code = code;
    this.details = opts.details;
  }

  get status(): number {
    return ERROR_HTTP_STATUS[this.code];
  }
}

export function isApiHttpError(err: unknown): err is ApiHttpError {
  return err instanceof ApiHttpError;
}

// ─── Responses ──────────────────────────────────────────────────────────────

const REQUEST_ID_HEADER = "x-request-id";

export function requestIdFrom(req: Request): string {
  return req.headers.get(REQUEST_ID_HEADER) ?? globalThis.crypto.randomUUID();
}

/** 2xx JSON response. `body` must already be wire-safe (no bigint — use .toString()). */
export function ok<T>(body: T, init: { status?: number; headers?: HeadersInit; requestId?: string } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  // Money and per-user data must never be cached; a route may opt in to
  // caching (e.g. public reference rates) by passing its own Cache-Control.
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  if (init.requestId) headers.set(REQUEST_ID_HEADER, init.requestId);
  return new Response(JSON.stringify(body), { status: init.status ?? 200, headers });
}

/** Non-2xx JSON response using the shared ApiError envelope. */
export function fail(code: ErrorCode, opts: { message?: string; requestId?: string } = {}): Response {
  const requestId = opts.requestId ?? globalThis.crypto.randomUUID();
  const body: ApiError = apiError(code, { message: opts.message, requestId });
  return ok(body, { status: ERROR_HTTP_STATUS[code], requestId });
}

// ─── Route wrapper ──────────────────────────────────────────────────────────

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response>;

/**
 * Wrap a route handler so every thrown error becomes a well-formed ApiError.
 * Generic over the Next.js context so `RouteContext<'/api/v1/cards/[id]'>`
 * flows through unchanged.
 */
export function route<Ctx = unknown>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    const requestId = requestIdFrom(req);
    try {
      const res = await handler(req, ctx);
      if (!res.headers.has(REQUEST_ID_HEADER)) {
        // Response headers may be immutable (e.g. Response.json) — clone if so.
        try {
          res.headers.set(REQUEST_ID_HEADER, requestId);
          return res;
        } catch {
          const headers = new Headers(res.headers);
          headers.set(REQUEST_ID_HEADER, requestId);
          return new Response(res.body, { status: res.status, headers });
        }
      }
      return res;
    } catch (err) {
      return toErrorResponse(err, requestId);
    }
  };
}

export function toErrorResponse(err: unknown, requestId: string): Response {
  if (isApiHttpError(err)) {
    return fail(err.code, { message: err.message === err.code ? undefined : err.message, requestId });
  }
  if (err instanceof MoneyError) {
    return fail("VALIDATION_ERROR", { message: err.message, requestId });
  }
  // Unknown: log with request_id so the operator can correlate.
  console.error(`[api] ${requestId} unhandled error`, err);
  return fail("INTERNAL_ERROR", { requestId });
}

// ─── Body parsing (no schema library; explicit field checks) ────────────────

export type JsonObject = Record<string, unknown>;
export type BodyParser<T> = (body: JsonObject) => T;

/**
 * Read and validate a JSON body. The parser receives a plain object and uses
 * the `field` helpers below; any thrown ApiHttpError / MoneyError becomes a
 * 400 VALIDATION_ERROR.
 *
 *   const body = await parseBody(req, (b) => ({
 *     amount_units: field.positiveMinorUnits(b, "amount_units"),
 *     method: field.oneOf(b, "method", ["mobile_money", "bank_transfer"] as const),
 *   }));
 */
export async function parseBody<T>(req: Request, parse: BodyParser<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Request body must be valid JSON." });
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Request body must be a JSON object." });
  }
  try {
    return parse(raw as JsonObject);
  } catch (err) {
    if (isApiHttpError(err)) throw err;
    if (err instanceof MoneyError) throw new ApiHttpError("VALIDATION_ERROR", { message: err.message });
    throw err;
  }
}

function invalid(key: string, why: string): ApiHttpError {
  return new ApiHttpError("VALIDATION_ERROR", { message: `${key}: ${why}`, details: { field: key } });
}

export const field = {
  string(body: JsonObject, key: string, opts: { min?: number; max?: number } = {}): string {
    const v = body[key];
    if (typeof v !== "string") throw invalid(key, "must be a string");
    const s = v.trim();
    if (opts.min !== undefined && s.length < opts.min) throw invalid(key, `must be at least ${opts.min} characters`);
    if (opts.max !== undefined && s.length > opts.max) throw invalid(key, `must be at most ${opts.max} characters`);
    return s;
  },

  optionalString(body: JsonObject, key: string, opts?: { min?: number; max?: number }): string | undefined {
    if (body[key] === undefined || body[key] === null) return undefined;
    return field.string(body, key, opts);
  },

  uuid(body: JsonObject, key: string): string {
    const s = field.string(body, key);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
      throw invalid(key, "must be a UUID");
    }
    return s;
  },

  oneOf<T extends string>(body: JsonObject, key: string, values: readonly T[]): T {
    const v = body[key];
    if (typeof v !== "string" || !(values as readonly string[]).includes(v)) {
      throw invalid(key, `must be one of ${values.join(", ")}`);
    }
    return v as T;
  },

  optionalOneOf<T extends string>(body: JsonObject, key: string, values: readonly T[]): T | undefined {
    if (body[key] === undefined) return undefined;
    return field.oneOf(body, key, values);
  },

  /** Minor units as a decimal string ("20400000"). Zero allowed. */
  minorUnits(body: JsonObject, key: string): bigint {
    const v = body[key];
    if (typeof v !== "string") throw invalid(key, "must be a string of minor units, e.g. \"20400000\"");
    try {
      return parseMinorUnits(v);
    } catch (e) {
      throw invalid(key, e instanceof Error ? e.message : "invalid amount");
    }
  },

  /** Minor units as a decimal string, strictly greater than zero. */
  positiveMinorUnits(body: JsonObject, key: string): bigint {
    const v = body[key];
    if (typeof v !== "string") throw invalid(key, "must be a string of minor units, e.g. \"20400000\"");
    try {
      return parsePositiveMinorUnits(v);
    } catch (e) {
      throw invalid(key, e instanceof Error ? e.message : "invalid amount");
    }
  },

  /** Present → positive minor units; explicit null → null; absent → undefined. */
  nullablePositiveMinorUnits(body: JsonObject, key: string): bigint | null | undefined {
    if (body[key] === undefined) return undefined;
    if (body[key] === null) return null;
    return field.positiveMinorUnits(body, key);
  },
};
