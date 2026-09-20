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

function generateRandomDigits(len: number): string {
  let res = "";
  for (let i = 0; i < len; i++) {
    res += Math.floor(Math.random() * 10).toString();
  }
  return res;
}

function generateRandomCardDetails(existingLast4?: string) {
  const prefixes = ["4532", "4916", "5241", "5412", "4124", "5105"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const mid1 = generateRandomDigits(4);
  const mid2 = generateRandomDigits(4);
  const last4 = existingLast4 || generateRandomDigits(4);
  return {
    card_number: `${prefix} ${mid1} ${mid2} ${last4}`,
    last4,
    cvv: generateRandomDigits(3),
    exp: "05/27",
  };
}

/** Profile row for a user. Throws NOT_FOUND if the signup trigger has not created it. */
export async function getProfile(userId: string): Promise<MeResponse> {
  const admin = createAdminClient();
  const [{ data, error }, authUserRes, cardRes] = await Promise.all([
    admin
      .from("profiles")
      .select("user_id, display_name, verification_status, role")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>(),
    admin.auth.admin.getUserById(userId),
    admin
      .from("cards")
      .select("last4")
      .eq("user_id", userId)
      .maybeSingle<{ last4: string }>(),
  ]);

  if (error) throw error;
  if (!data) throw new ApiHttpError("NOT_FOUND", { message: "Profile not found for this user." });

  const metadata = authUserRes.data?.user?.user_metadata || {};
  let cardDetails = metadata.card_details;

  if (!cardDetails || !cardDetails.card_number || !cardDetails.cvv) {
    cardDetails = generateRandomCardDetails(cardRes.data?.last4);
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        card_details: cardDetails,
      },
    });
  } else if (cardRes.data?.last4 && cardDetails.last4 !== cardRes.data.last4) {
    const last4 = cardRes.data.last4;
    const parts = cardDetails.card_number.split(" ");
    if (parts.length === 4) {
      parts[3] = last4;
      cardDetails.card_number = parts.join(" ");
    }
    cardDetails.last4 = last4;
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...metadata,
        card_details: cardDetails,
      },
    });
  }

  return {
    user_id: data.user_id,
    display_name: data.display_name,
    verification_status: data.verification_status,
    role: data.role,
    phone: metadata.phone || undefined,
    country: metadata.country || undefined,
    currency: metadata.currency || undefined,
    card_details: cardDetails,
  };
}

/** Update profile in profiles table and user metadata */
export async function updateProfile(
  userId: string,
  updates: { display_name?: string; phone?: string; country?: string; currency?: string }
): Promise<MeResponse> {
  const admin = createAdminClient();

  if (updates.display_name && updates.display_name.trim()) {
    const { error } = await admin
      .from("profiles")
      .update({ display_name: updates.display_name.trim() })
      .eq("user_id", userId);
    if (error) throw error;
  }

  const { data: userData } = await admin.auth.admin.getUserById(userId);
  const currentMeta = userData?.user?.user_metadata || {};
  const newMeta = {
    ...currentMeta,
    ...(updates.display_name ? { display_name: updates.display_name.trim() } : {}),
    ...(updates.phone !== undefined ? { phone: updates.phone.trim() } : {}),
    ...(updates.country !== undefined ? { country: updates.country.trim() } : {}),
    ...(updates.currency !== undefined ? { currency: updates.currency.trim() } : {}),
  };

  await admin.auth.admin.updateUserById(userId, { user_metadata: newMeta });

  return getProfile(userId);
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
