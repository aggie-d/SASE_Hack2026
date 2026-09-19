"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DemoBanner } from "@/components/DemoBanner";

type Tab = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName || email.split("@")[0] },
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // With "Confirm email" off, signUp returns a live session — go straight in.
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Check your email to confirm your account, then sign in.");
    setLoading(false);
  }

  return (
    <div className="min-h-screen">
      <DemoBanner />
      <main className="mx-auto flex max-w-sm flex-col px-4 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">LAD Transfer</h1>
        <p className="mt-1 text-sm text-stone-500">
          MWK deposits · USDT conversion · Virtual card
        </p>

        {/* Tabs */}
        <div className="mt-8 flex rounded-lg border border-stone-200 bg-stone-100 p-1">
          <button
            onClick={() => { setTab("signin"); setError(null); setMessage(null); }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === "signin"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Sign in
          </button>
          <button
            onClick={() => { setTab("signup"); setError(null); setMessage(null); }}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
              tab === "signup"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={tab === "signin" ? handleSignIn : handleSignUp}
          className="mt-4 flex flex-col gap-3"
        >
          {tab === "signup" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700">
                Display name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              minLength={6}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            {loading
              ? "Please wait…"
              : tab === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>
      </main>
    </div>
  );
}
