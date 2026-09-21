import type { MeResponse, UpdateProfileRequest } from "@/lib/contracts";
import { getProfile, requireUser, updateProfile } from "@/lib/server/auth";
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

/**
 * PATCH /api/v1/me
 * Update user display name, phone, country, and preferred currency.
 */
export const PATCH = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json()) as UpdateProfileRequest;
  const updated = await updateProfile(userId, body);
  return ok<MeResponse>(updated);
});

