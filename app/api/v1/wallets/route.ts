import type { WalletsResponse } from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";
import { getWalletBalances } from "@/lib/server/ledger/balances";

/**
 * GET /api/v1/wallets
 * Every user-owned account from the account_balances view:
 * mwk_wallet, usdt_wallet, card_funding — each with posted / held / available
 * minor units as strings and the asset's decimal exponent.
 *
 * 200 WalletsResponse · 401 UNAUTHORIZED
 */
export const GET = route(async () => {
  const { userId } = await requireUser();
  // Filter out the legacy MWK wallet so users only see their active USDT wallet and card funding accounts
  const allWallets = await getWalletBalances(userId);
  const wallets = allWallets.filter((w) => w.purpose !== "mwk_wallet");
  return ok<WalletsResponse>({ wallets });
});
