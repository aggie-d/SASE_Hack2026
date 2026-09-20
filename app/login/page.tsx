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
        <Link href="/" className="flex items-center gap-1 font-bold text-2xl tracking-tight">
          <span className="text-[#C9A227] text-3xl">LT</span>
          <span className="text-[#C9A227] ml-1">LAD</span>
          <span className="text-stone-900">Transfer</span>
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
              <span className="text-[#C9A227] text-3xl">LT</span>
              <span className="text-[#C9A227] ml-1">LAD</span>
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

            {/* Divider — guaranteed one line */}
            <div className="relative flex items-center my-6">
              <div className="flex-1 border-t border-stone-700" />
              <span className="px-3 text-xs text-stone-400 shrink-0 select-none whitespace-nowrap">
                Or log in with
              </span>
              <div className="flex-1 border-t border-stone-700" />
            </div>

            {/* Social Logins */}
            <div className="flex items-center justify-center gap-3">
              {/* Google */}
              <button
                type="button"
                className="w-12 h-12 rounded-xl bg-[#1F2937] border border-stone-700 flex items-center justify-center hover:bg-stone-800 transition-colors shadow-sm group"
                style={{ backgroundColor: "#1F2937" }}
                aria-label="Log in with Google"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </button>

              {/* Apple */}
              <button
                type="button"
                className="w-12 h-12 rounded-xl bg-[#1F2937] border border-stone-700 flex items-center justify-center hover:bg-stone-800 transition-colors shadow-sm group"
                style={{ backgroundColor: "#1F2937" }}
                aria-label="Log in with Apple"
              >
                <svg className="w-5 h-5 fill-white" viewBox="0 0 170 170">
                  <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.58-7.7-11.64-13.99-6.43-10.01-11.45-21.57-15.06-34.69-3.6-13.12-5.41-25.04-5.41-35.76 0-14.36 3.49-26.44 10.47-36.25 6.98-9.8 15.86-14.81 26.64-15.02 4.36 0 9.29 1.13 14.79 3.39 5.5 2.27 9.17 3.45 11.02 3.56 1.84-.11 5.61-1.32 11.31-3.64 5.7-2.31 10.47-3.34 14.32-3.08 11.22.65 20.35 4.97 27.4 12.98-9.92 6.01-14.77 14.44-14.54 25.32.22 8.39 3.49 15.42 9.8 21.09 6.32 5.66 13.88 8.94 22.7 9.82-2.18 6.74-4.89 13.59-8.13 20.55zM119.22 31.84c0-7.19 2.52-13.75 7.56-19.68 5.04-5.93 11.28-9.58 18.72-10.96.11 1.08.16 2 .16 2.76 0 7.08-2.67 13.79-8.01 20.12-5.34 6.34-11.83 9.94-19.47 10.82-.65-1.08-.96-2.1-96-3.06z" />
                </svg>
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

