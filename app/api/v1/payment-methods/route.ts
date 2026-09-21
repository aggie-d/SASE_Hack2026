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
  if (body.type !== "bank" && body.type !== "mobile") {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Card payment methods are not supported. Use bank transfer or mobile money.",
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

export const PATCH = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json()) as {
    id: string;
    name?: string;
    number?: string;
    cvv?: string;
    expiry?: string;
  };

  if (!body.id) {
    throw new ApiHttpError("VALIDATION_ERROR", {
      message: "Payment method ID is required.",
    });
  }

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const rawMethods: PaymentMethodItem[] = userData.user.user_metadata?.payment_methods || [];
  const index = rawMethods.findIndex((m) => m.id === body.id);

  if (index === -1) {
    throw new ApiHttpError("NOT_FOUND", { message: "Payment method not found." });
  }

  const current = rawMethods[index];
  let updatedSubtitle = current.subtitle;
  let updatedLast4 = current.last4;
  let updatedCardNumber = current.card_number;

  if (body.number && body.number.trim()) {
    const cleanNum = body.number.trim().replace(/\s+/g, "");
    // If not a masked placeholder like •••• 1234
    if (!cleanNum.includes("•") && !cleanNum.includes("*") && cleanNum.length >= 4) {
      updatedLast4 = cleanNum.slice(-4);
      updatedSubtitle = current.type === "mobile" ? cleanNum : `**** ${updatedLast4}`;
      updatedCardNumber = cleanNum;
    }
  }

  const updatedMethod: PaymentMethodItem = {
    ...current,
    title: body.name !== undefined && body.name.trim() ? body.name.trim() : current.title,
    subtitle: updatedSubtitle,
    last4: updatedLast4,
    card_number: updatedCardNumber,
    cvv: body.cvv !== undefined ? body.cvv.trim() : current.cvv,
    expiry: body.expiry !== undefined ? body.expiry.trim() : current.expiry,
  };

  const updatedList = [...rawMethods];
  updatedList[index] = updatedMethod;
  const filtered = updatedList.filter((m) => !m.id?.startsWith("pm-default-"));

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      payment_methods: filtered,
    },
  });

  return ok<{ payment_method: PaymentMethodItem; payment_methods: PaymentMethodItem[] }>({
    payment_method: updatedMethod,
    payment_methods: filtered,
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
