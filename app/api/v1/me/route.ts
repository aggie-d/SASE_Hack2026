import type { MeResponse } from "@/lib/contracts";
import { getProfile, requireUser } from "@/lib/server/auth";
import { ok, route } from "@/lib/server/http";

/**
 * GET /api/v1/me
 * Profile + verification status for the signed-in user.
 *
 * 200 MeResponse · 401 UNAUTHORIZED · 404 NOT_FOUND (profile not provisioned)
 */
export const GET = route(async () => {
  const { userId } = await requireUser();
  const profile: MeResponse = await getProfile(userId);
  return ok<MeResponse>(profile);
});
