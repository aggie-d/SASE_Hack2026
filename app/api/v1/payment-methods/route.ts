import type {
  CreatePaymentMethodRequest,
  PaymentMethodItem,
  PaymentMethodsResponse,
} from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError, ok, route } from "@/lib/server/http";

export const GET = route(async () => {
  const { userId } = await requireUser();
  const admin = createAdminClient();

  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const rawMethods = (userData.user.user_metadata?.payment_methods as PaymentMethodItem[]) || [];
  // Ensure default placeholder methods are filtered out so list defaults to empty
  const payment_methods = rawMethods.filter((m) => !m.id?.startsWith("pm-default-"));

  return ok<PaymentMethodsResponse>({ payment_methods });
});

export const POST = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json()) as CreatePaymentMethodRequest;

  if (!body.name || !body.number) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Name and number are required.",
    });
  }

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const rawMethods: PaymentMethodItem[] = userData.user.user_metadata?.payment_methods || [];
  const existing = rawMethods.filter((m) => !m.id?.startsWith("pm-default-"));

  const cleanNum = body.number.trim();
  const last4 = cleanNum.slice(-4) || "0000";
  const subtitle =
    body.type === "mobile" ? cleanNum : `**** ${last4}`;

  const newMethod: PaymentMethodItem = {
    id: `pm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: body.type,
    title: body.name.trim(),
    subtitle,
    icon_type: body.type,
    last4,
    cvv: body.cvv?.trim() || undefined,
    created_at: new Date().toISOString(),
  };

  const updatedMethods = [newMethod, ...existing];

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      payment_methods: updatedMethods,
    },
  });

  return ok<{ payment_method: PaymentMethodItem; payment_methods: PaymentMethodItem[] }>({
    payment_method: newMethod,
    payment_methods: updatedMethods,
  });
});

export const DELETE = route(async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    throw new ApiHttpError("VALIDATION_ERROR", { message: "Method ID is required." });
  }

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const rawMethods: PaymentMethodItem[] = userData.user.user_metadata?.payment_methods || [];
  const remaining = rawMethods.filter((m) => m.id !== id && !m.id?.startsWith("pm-default-"));

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      payment_methods: remaining,
    },
  });

  return ok<{ success: boolean; payment_methods: PaymentMethodItem[] }>({
    success: true,
    payment_methods: remaining,
  });
});
