"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff, Globe, Phone, ChevronDown, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Country = {
  name: string;
  iso2: string;
  unicodeFlag: string;
};

const defaultCountries: Country[] = [
  { name: "Australia", iso2: "AU", unicodeFlag: "🇦🇺" },
  { name: "Canada", iso2: "CA", unicodeFlag: "🇨🇦" },
  { name: "France", iso2: "FR", unicodeFlag: "🇫🇷" },
  { name: "Germany", iso2: "DE", unicodeFlag: "🇩🇪" },
  { name: "India", iso2: "IN", unicodeFlag: "🇮🇳" },
  { name: "Japan", iso2: "JP", unicodeFlag: "🇯🇵" },
  { name: "Kenya", iso2: "KE", unicodeFlag: "🇰🇪" },
  { name: "Malawi", iso2: "MW", unicodeFlag: "🇲🇼" },
  { name: "Nigeria", iso2: "NG", unicodeFlag: "🇳🇬" },
  { name: "South Africa", iso2: "ZA", unicodeFlag: "🇿🇦" },
  { name: "United Kingdom", iso2: "GB", unicodeFlag: "🇬🇧" },
  { name: "United States", iso2: "US", unicodeFlag: "🇺🇸" }
];

export default function Signup() {
  const [countries, setCountries] = useState<Country[]>(defaultCountries);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("https://countriesnow.space/api/v0.1/countries/flag/unicode")
      .then(res => res.json())
      .then(json => {
        if (json && !json.error && Array.isArray(json.data)) {
          setCountries((json.data as Country[]).sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch(e => console.error("Failed to fetch countries", e));
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    password: ""
  });

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const supabase = createClient();
    
    // Generate randomized virtual card details for the new account
    const prefixes = ["4532", "4916", "5241", "5412", "4124", "5105"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const mid1 = Math.floor(1000 + Math.random() * 9000).toString();
    const mid2 = Math.floor(1000 + Math.random() * 9000).toString();
    const last4 = Math.floor(1000 + Math.random() * 9000).toString();
    const cvv = Math.floor(100 + Math.random() * 900).toString();

    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          display_name: formData.fullName,
          phone: formData.phone,
          country: formData.country,
          card_details: {
            card_number: `${prefix} ${mid1} ${mid2} ${last4}`,
            last4,
            cvv,
            exp: "05/27",
          },
        },
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    // Redirect to login page with success notification
    window.location.href = "/login?message=" + encodeURIComponent("Account created successfully!");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center relative p-4 overflow-hidden">
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

      {/* Floating Light Wisps */}
      <div
        className="absolute pointer-events-none rounded-full"
        style={{ top: "18%", left: "12%", width: "80px", height: "80px", background: "rgba(96, 165, 250, 0.35)", filter: "blur(40px)", animation: "wisp-drift-1 12s ease-in-out 1.5s infinite" }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{ top: "65%", right: "10%", width: "100px", height: "100px", background: "rgba(201, 162, 39, 0.3)", filter: "blur(45px)", animation: "wisp-drift-2 15s ease-in-out 2s infinite" }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{ top: "40%", left: "55%", width: "60px", height: "60px", background: "rgba(96, 165, 250, 0.25)", filter: "blur(35px)", animation: "wisp-drift-3 10s ease-in-out 1.8s infinite" }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{ top: "75%", left: "30%", width: "70px", height: "70px", background: "rgba(201, 162, 39, 0.25)", filter: "blur(40px)", animation: "wisp-drift-4 13s ease-in-out 2.2s infinite" }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{ top: "25%", right: "25%", width: "90px", height: "90px", background: "rgba(96, 165, 250, 0.2)", filter: "blur(50px)", animation: "wisp-drift-1 14s ease-in-out 2.5s infinite" }}
      />

      {/* Top left logo */}
      <div className="absolute top-6 left-6 lg:top-8 lg:left-8 z-10">
        <Link href="/" className="flex items-center gap-1 font-bold text-2xl tracking-tight">
          <span className="text-[#C9A227] text-3xl">LT</span>
          <span className="text-[#C9A227] ml-1">LAD</span>
          <span className="text-stone-900">Transfer</span>
        </Link>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10 rounded-3xl p-8 sm:p-10 shadow-2xl border border-stone-800/80 overflow-hidden bg-[#0B1120]">
        {/* Inner card light effect */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-72 h-72 bg-blue-500/30 rounded-full blur-[70px] pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-1 font-bold text-xl tracking-tight mb-6">
            <span className="text-[#C9A227] text-2xl">LT</span>
            <span className="text-[#C9A227] ml-1">LAD</span>
            <span className="text-white">Transfer</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-stone-400 text-sm text-center">Join thousands of users managing global transfers</p>
        </div>

        <form onSubmit={handleSignup} className="relative z-10 space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label className="text-sm text-stone-300">Full Name <span className="text-[#C9A227]">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-stone-500" />
              </div>
              <input 
                type="text" 
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter your full name" 
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
              />
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="text-sm text-stone-300">Email Address <span className="text-[#C9A227]">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-stone-500" />
              </div>
              <input 
                type="email" 
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com" 
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
              />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-sm text-stone-300">Country <span className="text-[#C9A227]">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Globe className="h-5 w-5 text-stone-500" />
              </div>
              <select 
                required
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-10 py-3 appearance-none focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors"
              >
                <option value="" disabled className="text-stone-500">Select your country</option>
                {countries.map((country) => (
                  <option key={country.name} value={country.name}>
                    {country.unicodeFlag} {country.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <ChevronDown className="h-5 w-5 text-stone-500" />
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="text-sm text-stone-300">Phone Number <span className="text-[#C9A227]">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone className="h-5 w-5 text-stone-500" />
              </div>
              <input 
                type="tel" 
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+265 123 456 789" 
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm text-stone-300">Password <span className="text-[#C9A227]">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-stone-500" />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••" 
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-12 py-3 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer text-stone-500 hover:text-stone-300 transition-colors"
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] py-3.5 text-sm font-bold text-stone-900 shadow-[0_0_20px_rgba(201,162,39,0.3)] hover:shadow-[0_0_25px_rgba(201,162,39,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        </form>

        <div className="relative z-10 mt-8 text-center text-sm text-stone-400">
          Already have an account? <Link href="/login" className="text-[#C9A227] font-medium hover:underline">Log In</Link>
        </div>
      </div>
    </div>
  );
}
