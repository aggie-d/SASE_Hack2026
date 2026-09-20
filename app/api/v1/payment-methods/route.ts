import type {
  CreatePaymentMethodRequest,
  PaymentMethodItem,
  PaymentMethodsResponse,
} from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError, ok, route } from "@/lib/server/http";

const DEFAULT_METHODS: PaymentMethodItem[] = [
  {
    id: "pm-default-1",
    type: "card",
    title: "Mastercard",
    subtitle: "**** 1234",
    icon_type: "card",
    last4: "1234",
    cvv: "321",
    created_at: new Date().toISOString(),
  },
  {
    id: "pm-default-2",
    type: "bank",
    title: "National Bank of Malawi",
    subtitle: "**** 5678",
    icon_type: "bank",
    last4: "5678",
    created_at: new Date().toISOString(),
  },
];

export const GET = route(async () => {
  const { userId } = await requireUser();
  const admin = createAdminClient();

  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const existing = userData.user.user_metadata?.payment_methods as
    | PaymentMethodItem[]
    | undefined;

  const payment_methods = existing !== undefined ? existing : DEFAULT_METHODS;

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

  const existing: PaymentMethodItem[] =
    userData.user.user_metadata?.payment_methods || DEFAULT_METHODS;

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
  const id = req.nextUrl.searchParams.get("id");

  if (!id) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Payment method id is required.",
    });
  }

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const existing: PaymentMethodItem[] =
    userData.user.user_metadata?.payment_methods || DEFAULT_METHODS;

  const filtered = existing.filter((m) => m.id !== id);

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      payment_methods: filtered,
    },
  });

  return ok<{ success: true; payment_methods: PaymentMethodItem[] }>({
    success: true,
    payment_methods: filtered,
  });
});
