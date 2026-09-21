"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    // Grab the message from the query string without triggering Next.js static bailout warnings
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("message");
    if (msg) {
      setSuccessMessage(msg);
      // Optional: clean up URL so it doesn't persist on reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between items-center relative p-4 overflow-hidden">
      {/* 24-Column Animated Dot Grid Background */}
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

      {/* Soft Ambient Colorful Atmosphere */}
      <div
        className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-blue-400/10 rounded-full blur-[130px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.1s both" }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/10 rounded-full blur-[140px] pointer-events-none"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.35s both" }}
      />

      {/* Subtle Circuit Tech Lines in Background */}
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

      {/* Navigation Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-start px-2 py-4">
        <Link href="/" className="flex items-center gap-1 font-bold text-2xl tracking-tight group">
          <span className="text-[#C9A227]">LAD</span>
          <span className="text-white group-hover:text-blue-200 transition-colors">Transfer</span>
        </Link>
      </header>

      {/* Center Content: Login Card matching signup dark blue */}
      <main className="relative z-10 w-full flex-1 flex flex-col items-center justify-center py-6">
        <div 
          className="w-full max-w-md relative rounded-3xl p-8 sm:p-10 shadow-2xl border border-stone-800/80 overflow-hidden bg-[#0B1120] text-white"
          style={{ backgroundColor: "#0B1120" }}
        >
          {/* Inner card blue halo effect matching signup */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-500/30 rounded-full blur-[70px] pointer-events-none" />

          {/* Logo & Header — Non-clickable logo inside card */}
          <div className="relative z-10 flex flex-col items-center mb-7">
            <div className="flex items-center gap-1 font-bold text-2xl tracking-tight mb-5 select-none cursor-default">
              <span className="text-[#C9A227]">LAD</span>
              <span className="text-white">Transfer</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-white text-center">
              Welcome back to LADTransfer
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="relative z-10 space-y-4">
            {successMessage && (
              <div className="flex items-start gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Email Address */}
            <div className="space-y-1.5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
                  style={{ backgroundColor: "#1F2937" }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-stone-400" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-11 pr-16 py-3.5 text-sm focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
                  style={{ backgroundColor: "#1F2937" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-medium text-stone-400 hover:text-white transition-colors"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end pt-0.5">
              <Link
                href="/forgot-password"
                className="text-xs text-stone-400 hover:text-[#C9A227] transition-colors"
              >
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] py-3.5 text-sm font-bold text-stone-900 shadow-[0_0_20px_rgba(201,162,39,0.3)] hover:shadow-[0_0_25px_rgba(201,162,39,0.5)] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Logging in..." : "Log In"}
              </button>
            </div>

          </form>

          {/* Footer inside card */}
          <div className="relative z-10 mt-7 text-center text-sm text-stone-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#C9A227] font-semibold hover:underline">
              Sign Up
            </Link>
          </div>
        </div>
      </main>

      {/* Page Footer */}
      <footer className="relative z-10 py-4 text-center space-y-1">
        <p className="text-xs text-stone-500 font-medium">
          Transfer money safely and easily
        </p>
        <p className="text-[11px] text-stone-400">
          © 2026 LADTransfer. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

