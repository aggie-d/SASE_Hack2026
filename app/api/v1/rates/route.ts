import type { RatesResponse } from "@/lib/contracts";
import { ApiHttpError, ok, route } from "@/lib/server/http";
import { getUsdRates, RatesUnavailableError } from "@/lib/server/rates";

/**
 * GET /api/v1/rates[?symbols=MWK,USDT,EUR]
 *
 * Public (no session needed — nothing user-specific here). Returns live
 * USD-based reference rates for the deposit screen. `symbols` trims the
 * payload to the codes you care about; unknown codes are simply omitted so
 * the client can detect "not quoted" by absence.
 *
 * Cached upstream for an hour by lib/server/rates.ts; the Cache-Control here
 * lets the browser reuse it for five minutes between page visits.
 */
export const GET = route(async (req) => {
  let data: RatesResponse;
  try {
    data = await getUsdRates();
  } catch (err) {
    if (err instanceof RatesUnavailableError) {
      throw new ApiHttpError("PROVIDER_FAILED", {
        message: "Live exchange rates are temporarily unavailable.",
      });
    }
    throw err;
  }

  const symbolsParam = new URL(req.url).searchParams.get("symbols");
  if (symbolsParam) {
    const wanted = new Set(
      symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean),
    );
    wanted.add("USD");
    const rates: Record<string, number> = {};
    for (const code of wanted) {
      if (code in data.rates) rates[code] = data.rates[code];
    }
    data = { ...data, rates };
  }

  return ok<RatesResponse>(data, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
});
