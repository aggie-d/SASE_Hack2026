/**
 * Error code → HTTP status, retryability, and default user-facing message.
 * Used by API routes to build responses and by the frontend to branch on
 * `error.code`. Safe to import in client components.
 */

import type { ApiError, ErrorCode } from "./index";

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VERIFICATION_REQUIRED: 403,
  NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  QUOTE_EXPIRED: 422,
  INSUFFICIENT_FUNDS: 422,
  LIQUIDITY_UNAVAILABLE: 422,
  CARD_FROZEN: 422,
  LIMIT_EXCEEDED: 422,
  DEPOSIT_PENDING: 422,
  PROVIDER_FAILED: 422,
  PROVIDER_PENDING: 202,
  INTERNAL_ERROR: 500,
};

export const ERROR_RETRYABLE: Record<ErrorCode, boolean> = {
  VALIDATION_ERROR: false,
  UNAUTHORIZED: false,
  FORBIDDEN: false,
  VERIFICATION_REQUIRED: false,
  NOT_FOUND: false,
  IDEMPOTENCY_CONFLICT: false,
  QUOTE_EXPIRED: true, // get a new quote and retry
  INSUFFICIENT_FUNDS: false,
  LIQUIDITY_UNAVAILABLE: true,
  CARD_FROZEN: false,
  LIMIT_EXCEEDED: false,
  DEPOSIT_PENDING: true,
  PROVIDER_FAILED: false,
  PROVIDER_PENDING: true,
  INTERNAL_ERROR: true,
};

/** Actionable defaults. Never collapse these into "Something went wrong". */
export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  QUOTE_EXPIRED: "This quote expired. Get a new quote.",
  INSUFFICIENT_FUNDS: "Not enough available balance for this amount.",
  LIQUIDITY_UNAVAILABLE: "Not enough USDT liquidity is available. Try a smaller amount or try again later.",
  CARD_FROZEN: "Card frozen. Unfreeze the card to make a purchase.",
  LIMIT_EXCEEDED: "This amount is over the card's per-transaction limit.",
  DEPOSIT_PENDING: "Deposit is still pending. Funds are credited once the provider confirms.",
  PROVIDER_FAILED: "The provider could not complete this conversion. Request a new quote to try again.",
  VERIFICATION_REQUIRED: "Complete verification before continuing.",
  UNAUTHORIZED: "Sign in to continue.",
  FORBIDDEN: "You do not have access to this resource.",
  NOT_FOUND: "We could not find that record.",
  VALIDATION_ERROR: "The request is invalid. Check the highlighted fields.",
  IDEMPOTENCY_CONFLICT: "This Idempotency-Key was already used with a different request.",
  PROVIDER_PENDING: "The provider has not confirmed yet. Check back shortly.",
  INTERNAL_ERROR: "Something failed on our side. Try again.",
};

/** Build the standard error envelope. Server routes pair this with ERROR_HTTP_STATUS[code]. */
export function apiError(code: ErrorCode, opts: { message?: string; requestId?: string } = {}): ApiError {
  return {
    error: {
      code,
      message: opts.message ?? ERROR_MESSAGE[code],
      retryable: ERROR_RETRYABLE[code],
    },
    request_id: opts.requestId ?? globalThis.crypto.randomUUID(),
  };
}

/** Narrow an unknown JSON body to ApiError (for the frontend fetch layer). */
export function isApiError(body: unknown): body is ApiError {
  if (typeof body !== "object" || body === null) return false;
  const maybe = body as { error?: unknown; request_id?: unknown };
  if (typeof maybe.request_id !== "string" || typeof maybe.error !== "object" || maybe.error === null) return false;
  const err = maybe.error as { code?: unknown; message?: unknown; retryable?: unknown };
  return typeof err.code === "string" && err.code in ERROR_HTTP_STATUS && typeof err.message === "string";
}
