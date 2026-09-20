import type { MeResponse, VerifyMeRequest } from "@/lib/contracts";
import { getProfile, requireUser } from "@/lib/server/auth";
import { ApiHttpError, field, ok, parseBody, route } from "@/lib/server/http";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/v1/me/verify — simulated onboarding. Demo mode only.
 *
 * New signups are provisioned `unverified` and every money route past the
 * dashboard calls requireVerifiedUser(). This is the demo's stand-in for KYC:
 * it flips the caller to `verified` (optionally setting a fictional display
 * name) and records an audit event. No documents are collected.
 *
 * Body is optional. Idempotent: already verified → 200 with the profile.
 *
 * 200 MeResponse · 400 VALIDATION_ERROR · 401 UNAUTHORIZED · 404 (demo off)
 */
export const POST = route(async (req) => {
  // Hidden when demo mode is off, like the other /demo surfaces.
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") throw new ApiHttpError("NOT_FOUND");

  const { userId } = await requireUser();

  // Accept an empty body so a bare "Verify me" button works.
  const raw = await req.text();
  const body: VerifyMeRequest =
    raw.trim() === ""
      ? {}
      : await parseBody(new Request(req.url, { method: "POST", body: raw }), (b) => ({
          display_name: field.optionalString(b, "display_name", { min: 2, max: 80 }),
        }));

  const before = await getProfile(userId);

  if (before.verification_status === "verified" && body.display_name === undefined) {
    return ok<MeResponse>(before);
  }

  const admin = createAdminClient();

  const update: { verification_status: "verified"; display_name?: string } = {
    verification_status: "verified",
  };
  if (body.display_name !== undefined) update.display_name = body.display_name.trim();

  const { error: updateError } = await admin
    .from("profiles")
    .update(update)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  if (before.verification_status !== "verified") {
    const { error: auditError } = await admin.from("audit_events").insert({
      actor_id: userId,
      action: "demo.verify_user",
      target_id: userId,
    });
    if (auditError) throw auditError;
  }

  return ok<MeResponse>(await getProfile(userId));
});
