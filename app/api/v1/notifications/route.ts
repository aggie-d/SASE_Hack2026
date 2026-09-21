import type {
  NotificationItem,
  NotificationsResponse,
} from "@/lib/contracts";
import { requireUser } from "@/lib/server/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiHttpError, ok, route } from "@/lib/server/http";

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-1",
    title: "Welcome to LADTransfer",
    message: "Your account is live! Enjoy instant conversions between MWK and USDT.",
    time: "Just now",
    type: "system",
    is_unread: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "notif-2",
    title: "Virtual Card Ready",
    message: "Your LADTransfer virtual card has been issued and is available on your dashboard.",
    time: "1 hour ago",
    type: "card",
    is_unread: true,
    created_at: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: "notif-3",
    title: "System Update",
    message: "Enhanced security and real-time ledger settlement are now enabled.",
    time: "Yesterday",
    type: "security",
    is_unread: false,
    created_at: new Date(Date.now() - 86400 * 1000).toISOString(),
  },
];

export const GET = route(async () => {
  const { userId } = await requireUser();
  const admin = createAdminClient();

  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const existing = userData.user.user_metadata?.notifications as
    | NotificationItem[]
    | undefined;

  const notifications = existing !== undefined ? existing : DEFAULT_NOTIFICATIONS;
  const unread_count = notifications.filter((n) => n.is_unread).length;

  return ok<NotificationsResponse>({
    notifications,
    unread_count,
  });
});

export const PATCH = route(async (req) => {
  const { userId } = await requireUser();
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    mark_all_read?: boolean;
  };

  const admin = createAdminClient();
  const { data: userData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !userData.user) {
    throw new ApiHttpError("NOT_FOUND", { message: "User not found." });
  }

  const existing: NotificationItem[] =
    userData.user.user_metadata?.notifications || DEFAULT_NOTIFICATIONS;

  const updated = existing.map((n) => {
    if (body.mark_all_read || (body.id && n.id === body.id)) {
      return { ...n, is_unread: false };
    }
    return n;
  });

  await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...userData.user.user_metadata,
      notifications: updated,
    },
  });

  const unread_count = updated.filter((n) => n.is_unread).length;

  return ok<NotificationsResponse>({
    notifications: updated,
    unread_count,
  });
});
