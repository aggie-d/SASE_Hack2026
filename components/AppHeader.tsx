"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import type { MeResponse, NotificationsResponse } from "@/lib/contracts";

type AppHeaderProps = {
  active?: "dashboard" | "deposit" | "profile" | "analytics" | "notifications";
  onInterceptNavigate?: (url: string) => void;
};

export function AppHeader({ active, onInterceptNavigate }: AppHeaderProps) {
  const router = useRouter();
  const [userName, setUserName] = useState<string>("User");
  const [initials, setInitials] = useState<string>("LT");
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    async function loadHeaderData() {
      try {
        const [meRes, notifRes] = await Promise.all([
          fetch("/api/v1/me"),
          fetch("/api/v1/notifications"),
        ]);

        if (meRes.status === 401 && isMounted) {
          router.push("/login");
          return;
        }

        if (meRes.ok && isMounted) {
          const meData = (await meRes.json()) as MeResponse;
          if (meData.display_name) {
            setUserName(meData.display_name);
            const words = meData.display_name.trim().split(/\s+/);
            const inits = words
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);
            setInitials(inits || "LT");
          }
        }

        if (notifRes.ok && isMounted) {
          const notifData = (await notifRes.json()) as NotificationsResponse;
          setUnreadCount(notifData.unread_count ?? 0);
        }
      } catch {
        // Safe fallback
      }
    }

    loadHeaderData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNav = (url: string) => {
    if (onInterceptNavigate) {
      onInterceptNavigate(url);
    } else {
      router.push(url);
    }
  };

  return (
    <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-5">
      <div className="bg-[#0B1528] rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg border border-slate-800">
        {/* Brand Logo - Navigate directly to Dashboard */}
        <button
          type="button"
          onClick={() => handleNav("/dashboard")}
          className="flex items-center gap-1 font-bold text-xl tracking-tight text-left group"
        >
          <span className="text-[#C9A227] text-2xl">LT</span>
          <span className="text-[#C9A227] ml-0.5">LAD</span>
          <span className="text-white group-hover:text-blue-200 transition-colors">Transfer</span>
        </button>

        {/* Consistent Nav Items: Dashboard, Analytics, Deposit */}
        <nav className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleNav("/dashboard")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              active === "dashboard"
                ? "text-white bg-blue-600/30 border border-blue-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => handleNav("/analytics")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              active === "analytics"
                ? "text-white bg-blue-600/30 border border-blue-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Analytics
          </button>
          <button
            type="button"
            onClick={() => handleNav("/deposit")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              active === "deposit"
                ? "text-white bg-blue-600/30 border border-blue-500/40 shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            Deposit
          </button>
        </nav>

        {/* Right Header Actions: Notification Bell + Profile Avatar */}
        <div className="flex items-center gap-3">
          {/* Notification Bell with Badge */}
          <button
            type="button"
            onClick={() => handleNav("/notifications")}
            className={`relative p-2 rounded-xl border transition-colors ${
              active === "notifications"
                ? "bg-blue-600/30 border-blue-500/40 text-[#DFB338] shadow-sm"
                : "bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-[#C9A227]"
            }`}
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Picture / Avatar */}
          <button
            type="button"
            onClick={() => handleNav("/profile")}
            className={`flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border transition-all group ${
              active === "profile"
                ? "bg-slate-800 border-[#C9A227] shadow-sm"
                : "bg-slate-800/60 hover:bg-slate-800 border-slate-700/80"
            }`}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#DFB338] to-[#B8911E] flex items-center justify-center text-stone-900 font-bold text-xs shadow-sm uppercase">
              {initials}
            </div>
            <span
              className={`hidden sm:inline text-xs font-semibold transition-colors ${
                active === "profile" ? "text-[#C9A227]" : "text-white group-hover:text-[#C9A227]"
              }`}
            >
              {userName}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
