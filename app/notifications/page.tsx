"use client";

import { AppHeader } from "@/components/AppHeader";
import { ArrowDownLeft, ShieldAlert, Bell, BellOff, CheckCircle2, AlertTriangle } from "lucide-react";

const notifications = [
  // {
  //   id: 1,
  //   title: "Transfer Received",
  //   message: "You received +$250.00 USD from John Doe.",
  //   time: "2 minutes ago",
  //   icon: ArrowDownLeft,
  //   iconColor: "text-emerald-400",
  //   bgColor: "bg-emerald-400/10",
  //   borderColor: "border-emerald-500/20",
  //   isUnread: true,
  // },
  // {
  //   id: 2,
  //   title: "Security Alert",
  //   message: "New device logged into your account from Blantyre, MW.",
  //   time: "1 hour ago",
  //   icon: ShieldAlert,
  //   iconColor: "text-red-400",
  //   bgColor: "bg-red-400/10",
  //   borderColor: "border-red-500/20",
  //   isUnread: true,
  // },
  // {
  //   id: 3,
  //   title: "Virtual Card Activated",
  //   message: "Your LADTransfer virtual card is now ready for online purchases.",
  //   time: "Yesterday",
  //   icon: CheckCircle2,
  //   iconColor: "text-[#DFB338]",
  //   bgColor: "bg-[#DFB338]/10",
  //   borderColor: "border-[#DFB338]/20",
  //   isUnread: false,
  // },
  // {
  //   id: 4,
  //   title: "System Maintenance",
  //   message: "Scheduled maintenance will occur on Sunday at 2:00 AM CAT.",
  //   time: "2 days ago",
  //   icon: Bell,
  //   iconColor: "text-blue-400",
  //   bgColor: "bg-blue-400/10",
  //   borderColor: "border-blue-500/20",
  //   isUnread: false,
  // },
  // {
  //   id: 5,
  //   title: "Spending Limit Approaching",
  //   message: "You have used 90% of your monthly conversion limit.",
  //   time: "3 days ago",
  //   icon: AlertTriangle,
  //   iconColor: "text-amber-400",
  //   bgColor: "bg-amber-400/10",
  //   borderColor: "border-amber-500/20",
  //   isUnread: false,
  // }
];

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Background: Animated Dot-Matrix Wave — 24 narrow strips for a smooth sine-wave sweep */}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{
            left: `${(i * 100) / 24}%`,
            width: `${100 / 24}%`,
            backgroundImage: "radial-gradient(#475569 2px, transparent 2px)",
            backgroundSize: "26px 26px",
            backgroundAttachment: "fixed",
            opacity: 0.5,
            animation: `dot-wave 0.8s ease-in-out ${(i * 0.035).toFixed(3)}s`,
          }}
        />
      ))}

      {/* Soft Ambient Glows */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.1s both" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.35s both" }}
      />

      {/* Circuit Tech Lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        xmlns="http://www.w3.org/2000/svg"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.15s both" }}
      >
        <path d="M0,150 L200,150 L260,210 L500,210" fill="none" stroke="#0066FF" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="260" cy="210" r="3.5" fill="#0066FF" />
        <path d="M1000,600 L1200,600 L1260,540 L1600,540" fill="none" stroke="#C9A227" strokeWidth="1.5" strokeDasharray="4 4" />
        <circle cx="1260" cy="540" r="3.5" fill="#C9A227" />
        <circle cx="200" cy="150" r="2.5" fill="#0066FF" />
      </svg>

      {/* Floating Light Wisps — appear after the wave animation completes */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "18%",
          left: "12%",
          width: "80px",
          height: "80px",
          background: "rgba(96, 165, 250, 0.35)",
          filter: "blur(40px)",
          animation: "wisp-drift-1 12s ease-in-out 1.5s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "65%",
          right: "10%",
          width: "100px",
          height: "100px",
          background: "rgba(201, 162, 39, 0.3)",
          filter: "blur(45px)",
          animation: "wisp-drift-2 15s ease-in-out 2s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "40%",
          left: "55%",
          width: "60px",
          height: "60px",
          background: "rgba(96, 165, 250, 0.25)",
          filter: "blur(35px)",
          animation: "wisp-drift-3 10s ease-in-out 1.8s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "75%",
          left: "30%",
          width: "70px",
          height: "70px",
          background: "rgba(201, 162, 39, 0.25)",
          filter: "blur(40px)",
          animation: "wisp-drift-4 13s ease-in-out 2.2s infinite",
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          top: "25%",
          right: "25%",
          width: "90px",
          height: "90px",
          background: "rgba(96, 165, 250, 0.2)",
          filter: "blur(50px)",
          animation: "wisp-drift-1 14s ease-in-out 2.5s infinite",
        }}
      />

      {/* Consistent Navigation Header */}
      <div style={{ animation: "wave-lift 0.9s ease-in-out 0.08s both" }}>
        <AppHeader active="notifications" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-3xl mx-auto flex-1 flex flex-col items-center px-4 py-8 sm:py-10">
        <div className="w-full">
          <div 
            className="mb-8"
            style={{ animation: "wave-lift 0.9s ease-in-out 0.15s both" }}
          >
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight text-center">
              Notifications
            </h1>
          </div>

          <div className="w-full space-y-4">
            {notifications.length === 0 ? (
              <div 
                className="bg-[#0B1528] rounded-3xl p-10 sm:p-14 shadow-xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden"
                style={{ animation: "wave-lift 0.9s ease-in-out 0.2s both" }}
              >
                {/* Subtle ambient glow behind the empty state icon */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-blue-500/10 rounded-full blur-[50px] pointer-events-none" />
                
                <div className="relative z-10 w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-5 border border-slate-700/50 shadow-inner">
                  <BellOff className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="relative z-10 text-xl font-bold text-white mb-2">
                  You're all caught up!
                </h3>
                <p className="relative z-10 text-sm text-slate-400 max-w-sm">
                  There are no new notifications at this time. We'll let you know when something important happens.
                </p>
              </div>
            ) : (
              notifications.map((notification, index) => {
                const Icon = notification.icon;
                return (
                  <div
                    key={notification.id}
                    className={`bg-[#0B1528] rounded-2xl p-5 shadow-lg border relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 ${
                      notification.isUnread ? "border-blue-500/50" : "border-slate-800"
                    }`}
                    style={{ animation: `wave-lift 0.9s ease-in-out ${0.2 + index * 0.08}s both` }}
                  >
                    {/* Unread indicator dot */}
                    {notification.isUnread && (
                      <div className="absolute top-1/2 left-2.5 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    )}
                    
                    <div className={`flex items-start gap-4 ${notification.isUnread ? "ml-3" : ""}`}>
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border ${notification.bgColor} ${notification.borderColor}`}>
                        <Icon className={`w-6 h-6 ${notification.iconColor}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className={`text-base font-bold truncate ${notification.isUnread ? "text-white" : "text-slate-200"}`}>
                            {notification.title}
                          </h3>
                          <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {notification.time}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          {notification.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer 
        className="relative z-10 py-5 text-center text-xs text-stone-500"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.65s both" }}
      >
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>
    </div>
  );
}
