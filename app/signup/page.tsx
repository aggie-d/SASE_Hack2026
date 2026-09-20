import Link from "next/link";
import { User, Mail, Lock, EyeOff, Globe, Phone, ChevronDown } from "lucide-react";

type Country = {
  name: string;
  iso2: string;
  unicodeFlag: string;
};

export default async function Signup() {
  let countries: Country[] = [];
  try {
    const res = await fetch("https://countriesnow.space/api/v0.1/countries/flag/unicode", {
      next: { revalidate: 86400 } // Cache for 24h
    });
    if (res.ok) {
      const json = await res.json();
      if (json && !json.error && Array.isArray(json.data)) {
        countries = (json.data as Country[]).sort((a, b) => a.name.localeCompare(b.name));
      }
    } else {
      console.error("CountriesNow API returned status:", res.status);
    }
  } catch (e) {
    console.error("Failed to fetch countries", e);
  }

  // Fallback to a predefined list if network fails
  if (countries.length === 0) {
    countries = [
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
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center relative p-4 overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#C9A227]/10 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

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

        <form className="relative z-10 space-y-5">
          {/* Full Name */}
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
                defaultValue=""
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-10 py-3 appearance-none focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors"
              >
                <option value="" disabled className="text-stone-500">Select your country</option>
                {countries.map((country) => (
                  <option key={country.name} value={country.iso2 || country.name}>
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
                type="password" 
                required
                placeholder="••••••••" 
                className="w-full bg-[#1F2937] border border-stone-700 text-white rounded-xl pl-10 pr-10 py-3 focus:outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227] transition-colors placeholder:text-stone-500"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer">
                <EyeOff className="h-5 w-5 text-stone-500 hover:text-stone-300 transition-colors" />
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <div className="flex items-start pt-2">
            <div className="flex items-center h-5">
              <input 
                id="terms" 
                type="checkbox" 
                required
                className="w-4 h-4 rounded bg-[#1F2937] border-stone-600 text-[#C9A227] focus:ring-[#C9A227] focus:ring-offset-[#111827]"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="terms" className="text-stone-300">
                I agree to the <a href="#" className="text-[#C9A227] hover:underline">Terms of Service</a> and <a href="#" className="text-[#C9A227] hover:underline">Privacy Policy</a> <span className="text-[#C9A227]">*</span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button 
              type="submit" 
              className="w-full rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] py-3.5 text-sm font-bold text-stone-900 shadow-[0_0_20px_rgba(201,162,39,0.3)] hover:shadow-[0_0_25px_rgba(201,162,39,0.5)] transition-all"
            >
              Create Account
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
