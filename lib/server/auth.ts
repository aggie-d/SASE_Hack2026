import "server-only";

import type { MeResponse, UserRole, VerificationStatus } from "@/lib/contracts";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { ApiHttpError } from "./http";

/**
 * Server-side identity helpers for API routes.
 *
 * requireUser() reads the Supabase session from cookies (set by proxy.ts /
 * the login page) and returns the caller's user id, or throws 401.
 * Everything below a route should take `userId` as a parameter rather than
 * re-reading the session.
 */

export type AuthedUser = { userId: string };

export async function requireUser(): Promise<AuthedUser> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiHttpError("UNAUTHORIZED");
  }
  return { userId: user.id };
}

type ProfileRow = {
  user_id: string;
  display_name: string;
  verification_status: VerificationStatus;
  role: UserRole;
};

/** Profile row for a user. Throws NOT_FOUND if the signup trigger has not created it. */
export async function getProfile(userId: string): Promise<MeResponse> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, display_name, verification_status, role")
    .eq("user_id", userId)
    .maybeSingle<ProfileRow>();

  if (error) throw error;
  if (!data) throw new ApiHttpError("NOT_FOUND", { message: "Profile not found for this user." });

  return {
    user_id: data.user_id,
    display_name: data.display_name,
    verification_status: data.verification_status,
    role: data.role,
  };
}

/** requireUser + profiles.role = 'operator', else 403. For demo/operator routes (Workstream D). */
export async function requireOperator(): Promise<AuthedUser & { profile: MeResponse }> {
  const { userId } = await requireUser();
  const profile = await getProfile(userId);
  if (profile.role !== "operator") {
    throw new ApiHttpError("FORBIDDEN", { message: "Operator role required." });
  }
  return { userId, profile };
}

/** requireUser + verification_status = 'verified', else 403 VERIFICATION_REQUIRED. For conversions/cards. */
export async function requireVerifiedUser(): Promise<AuthedUser & { profile: MeResponse }> {
  const { userId } = await requireUser();
  const profile = await getProfile(userId);
  if (profile.verification_status !== "verified") {
    throw new ApiHttpError("VERIFICATION_REQUIRED");
  }
  return { userId, profile };
}
