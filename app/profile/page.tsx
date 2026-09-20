"use client";

import { useState, useRef, ChangeEvent, useEffect } from "react";
import Link from "next/link";
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Camera, 
  Plus, 
  CreditCard, 
  Building2, 
  Smartphone, 
  X, 
  Edit3, 
  Trash2,
  Lock,
  LogOut,
  ChevronDown
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";

const CURRENCY_OPTIONS = [
  { code: "MWK", name: "Malawian Kwacha", flag: "🇲🇼" },
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "USDT", name: "Tether USD (Stablecoin)", flag: "₮" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
  { code: "ZAR", name: "South African Rand", flag: "🇿🇦" },
  { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪" },
  { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬" },
  { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
  { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬" },
];

const COUNTRY_OPTIONS = [
  { name: "Malawi", code: "MW", flag: "🇲🇼" },
  { name: "United States", code: "US", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧" },
  { name: "South Africa", code: "ZA", flag: "🇿🇦" },
  { name: "Kenya", code: "KE", flag: "🇰🇪" },
  { name: "Nigeria", code: "NG", flag: "🇳🇬" },
  { name: "India", code: "IN", flag: "🇮🇳" },
  { name: "Japan", code: "JP", flag: "🇯🇵" },
  { name: "United Arab Emirates", code: "AE", flag: "🇦🇪" },
  { name: "Singapore", code: "SG", flag: "🇸🇬" },
  { name: "Canada", code: "CA", flag: "🇨🇦" },
  { name: "Germany", code: "DE", flag: "🇩🇪" },
  { name: "France", code: "FR", flag: "🇫🇷" },
  { name: "Australia", code: "AU", flag: "🇦🇺" },
  { name: "China", code: "CN", flag: "🇨🇳" },
  { name: "Brazil", code: "BR", flag: "🇧🇷" },
  { name: "Mexico", code: "MX", flag: "🇲🇽" },
  { name: "Philippines", code: "PH", flag: "🇵🇭" },
  { name: "Indonesia", code: "ID", flag: "🇮🇩" },
  { name: "South Korea", code: "KR", flag: "🇰🇷" },
  { name: "Zambia", code: "ZM", flag: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", flag: "🇿🇼" },
  { name: "Tanzania", code: "TZ", flag: "🇹🇿" },
  { name: "Ghana", code: "GH", flag: "🇬🇭" },
  { name: "Rwanda", code: "RW", flag: "🇷🇼" },
  { name: "Uganda", code: "UG", flag: "🇺🇬" },
  { name: "Botswana", code: "BW", flag: "🇧🇼" },
];

function getCountryInfo(countryName: string) {
  const normalized = (countryName || "").trim().toLowerCase();
  const match = COUNTRY_OPTIONS.find(
    (c) => c.name.toLowerCase() === normalized || c.code.toLowerCase() === normalized
  );
  if (match) return match;
  return {
    name: countryName || "Malawi",
    code: (countryName || "MW").slice(0, 2).toUpperCase(),
    flag: "🌐",
  };
}

type PaymentMethod = {
  id: string;
  type: "card" | "bank" | "mobile";
  title: string;
  subtitle: string;
  iconType: "card" | "bank" | "mobile";
};

export default function ProfilePage() {
  // Profile state
  const [profileData, setProfileData] = useState({
    name: "Loading...",
    email: "Loading...",
    accountId: "...",
    phone: "Loading...",
    country: "Malawi",
    currency: "MWK",
  });
  const [verificationStatus, setVerificationStatus] = useState<"unverified" | "pending" | "verified">("unverified");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isAddingMethod, setIsAddingMethod] = useState(false);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Modals state
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ ...profileData });

  // Add Method Form State
  const [newMethodType, setNewMethodType] = useState<"card" | "bank" | "mobile">("card");
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodNumber, setNewMethodNumber] = useState("");
  const [newMethodCvv, setNewMethodCvv] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: authData } = await supabase.auth.getUser();
      const email = authData.user?.email || "No email found";

      try {
        const [meRes, pmRes] = await Promise.all([
          fetch("/api/v1/me"),
          fetch("/api/v1/payment-methods"),
        ]);

        if (meRes.ok) {
          const data = await meRes.json();
          const loaded = {
            name: data.display_name || "User",
            email: email,
            accountId: data.user_id,
            phone: data.phone || "Not set",
            country: data.country || "Malawi",
            currency: data.currency || "MWK",
          };
          setProfileData(loaded);
          setEditFormData(loaded);
          setVerificationStatus(data.verification_status);
        }

        if (pmRes.ok) {
          const pmData = await pmRes.json();
          if (pmData.payment_methods) {
            setPaymentMethods(
              pmData.payment_methods.map((m: any) => ({
                id: m.id,
                type: m.type,
                title: m.title,
                subtitle: m.subtitle,
                iconType: m.icon_type,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load profile", err);
      }
    }
    loadProfile();
  }, []);

  // Compute dynamic initials
  const userInitials =
    profileData.name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  // Compute dynamic country info (flag and letters)
  const countryInfo = getCountryInfo(profileData.country);

  // Handle Profile Picture Change (Requirement 4)
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCopyAccountId = () => {
    navigator.clipboard.writeText(profileData.accountId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName || !newMethodNumber) return;

    setIsAddingMethod(true);
    try {
      const res = await fetch("/api/v1/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newMethodType,
          name: newMethodName,
          number: newMethodNumber,
          cvv: newMethodType === "card" ? newMethodCvv : undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(
          data.payment_methods.map((m: any) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            subtitle: m.subtitle,
            iconType: m.icon_type,
          }))
        );
        setShowAddMethodModal(false);
        setNewMethodName("");
        setNewMethodNumber("");
        setNewMethodCvv("");
      }
    } catch (err) {
      console.error("Failed to add payment method", err);
    } finally {
      setIsAddingMethod(false);
    }
  };

  const handleRemovePaymentMethod = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/payment-methods?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const data = await res.json();
        setPaymentMethods(
          data.payment_methods.map((m: any) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            subtitle: m.subtitle,
            iconType: m.icon_type,
          }))
        );
      }
    } catch (err) {
      console.error("Failed to remove payment method", err);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const res = await fetch("/api/v1/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: editFormData.name,
          phone: editFormData.phone,
          country: editFormData.country,
          currency: editFormData.currency,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfileData((prev) => ({
          ...prev,
          name: updated.display_name,
          phone: updated.phone || "Not set",
          country: updated.country || "Malawi",
          currency: updated.currency || "MWK",
        }));
        setShowEditProfileModal(false);
      }
    } catch (err) {
      console.error("Failed to save profile", err);
    } finally {
      setIsSavingProfile(false);
    }
  };
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

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

      {/* Floating Light Wisps */}
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

      {/* Consistent Top Navigation Header */}
      <div style={{ animation: "wave-lift 0.9s ease-in-out 0.08s both" }}>
        <AppHeader active="profile" />
      </div>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-6xl xl:max-w-7xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full space-y-6">
          
          {/* Top Profile Summary Card */}
          <div 
            className="bg-[#0B1528] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 text-white relative overflow-hidden"
            style={{ animation: "wave-lift 0.9s ease-in-out 0.22s both" }}
          >
            {/* Subtle card glow */}
            <div className="absolute -top-24 right-10 w-64 h-64 bg-[#C9A227]/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-6 sm:gap-8">
              {/* Profile Avatar with Change Picture Button (Requirement 4) */}
              <div className="relative group shrink-0">
                <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-[#DFB338] to-[#B8911E] p-1 shadow-xl relative overflow-hidden flex items-center justify-center">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#131F37] flex items-center justify-center text-4xl sm:text-5xl font-extrabold text-[#DFB338] select-none">
                      {userInitials}
                    </div>
                  )}
                </div>

                {/* Change Photo Trigger Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 p-2.5 rounded-full bg-[#C9A227] hover:bg-[#b8911e] text-stone-950 shadow-lg transition-all hover:scale-110 active:scale-95"
                  title="Change profile picture"
                  aria-label="Change profile picture"
                >
                  <Camera className="w-4 h-4" />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoUpload}
                  accept="image/*"
                  className="hidden"
                />
              </div>

              {/* User Identity Info */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {profileData.name}
                    </h1>
                    <p className="text-sm text-slate-400 font-medium mt-1">
                      {profileData.email}
                    </p>
                    {/* Account ID Pill with Copy */}
                    <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#DFB338]/20 via-[#DFB338]/10 to-transparent border border-[#DFB338]/40 text-[#DFB338] text-xs font-bold font-mono">
                        <span>Account ID: {profileData.accountId}</span>
                        <button
                          type="button"
                          onClick={handleCopyAccountId}
                          className="text-slate-400 hover:text-white transition-colors"
                          title="Copy Account ID"
                        >
                          {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column: Status Badge & Edit Button */}
                  <div className="flex flex-col gap-2 self-center sm:self-center">
                    {/* Account Status Badge */}
                    <div className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-sm w-full sm:w-auto
                      ${verificationStatus === 'verified' ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-400' : 'bg-amber-950/80 border border-amber-500/40 text-amber-400'}
                    `}>
                      <CheckCircle2 className={`w-4 h-4 ${verificationStatus === 'verified' ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <span>Account status: {verificationStatus.charAt(0).toUpperCase() + verificationStatus.slice(1)}</span>
                    </div>

                    {/* Edit Profile CTA */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditFormData({ ...profileData });
                        setShowEditProfileModal(true);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 hover:border-slate-600 text-slate-200 hover:text-white transition-all text-xs font-semibold shadow-sm w-full sm:w-auto"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Profile</span>
                    </button>

                    {/* Log Out Button */}
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 text-red-500 hover:text-red-400 transition-all text-xs font-semibold shadow-sm w-full sm:w-auto mt-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Details Row: Phone, Country, Preferred Currency */}
          <div 
            className="bg-[#0B1528] rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 text-white"
            style={{ animation: "wave-lift 0.9s ease-in-out 0.30s both" }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80 text-center sm:text-left gap-4 sm:gap-0">
              {/* Phone Number */}
              <div className="sm:px-6 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Phone Number
                </p>
                <p className="text-base sm:text-lg font-bold text-white">
                  {profileData.phone}
                </p>
              </div>

              {/* Country */}
              <div className="sm:px-6 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Country
                </p>
                <p className="text-base sm:text-lg font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                  <span className="text-xs font-mono font-extrabold px-1.5 py-0.5 rounded bg-slate-800 text-[#DFB338] border border-slate-700">
                    {countryInfo.code}
                  </span>
                  
                  <span>{profileData.country}</span>
                </p>
              </div>

              {/* Preferred Currency */}
              <div className="sm:px-6 py-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Preferred Currency
                </p>
                <p className="text-base sm:text-lg font-bold text-[#DFB338]">
                  ({profileData.currency})
                </p>
              </div>
            </div>
          </div>

          {/* Linked Payment Methods (Requirement 3: With Button to Link New Method) */}
          <div 
            className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white"
            style={{ animation: "wave-lift 0.9s ease-in-out 0.38s both" }}
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800/80">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Linked Payment Methods
                </h2>
                <p className="text-xs text-slate-400">
                  Manage accounts and cards used for global deposits
                </p>
              </div>

              {/* Button to Link New Payment Method (Requirement 3) */}
              <button
                type="button"
                onClick={() => setShowAddMethodModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] hover:from-[#e5bc42] hover:to-[#c49a21] text-stone-950 font-bold text-xs shadow-md transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Link New Payment Method</span>
              </button>
            </div>

            {/* Methods Grid or Empty State */}
            {paymentMethods.length === 0 ? (
              <div className="rounded-2xl bg-[#131F37]/50 border border-slate-800/80 p-8 sm:p-10 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-[#DFB338] mb-3 shadow-inner">
                  <CreditCard className="w-6 h-6 stroke-[1.8]" />
                </div>
                <p className="text-sm sm:text-base font-bold text-white mb-1.5">
                  Link an account to start spending!
                </p>
                <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                  Add a credit or debit card, bank account, or mobile money wallet to fund your card and manage global transactions.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddMethodModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] hover:from-[#e5bc42] hover:to-[#c49a21] text-stone-950 font-bold text-xs shadow-md transition-all active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>Link New Payment Method</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="rounded-2xl bg-[#131F37] border border-slate-700/60 p-4 flex items-center justify-between group hover:border-[#DFB338]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-[#DFB338]">
                        {method.iconType === "card" && <CreditCard className="w-5 h-5" />}
                        {method.iconType === "bank" && <Building2 className="w-5 h-5" />}
                        {method.iconType === "mobile" && <Smartphone className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{method.title}</p>
                        <p className="text-xs font-mono text-slate-400">{method.subtitle}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemovePaymentMethod(method.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors opacity-60 group-hover:opacity-100"
                      title="Remove method"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer 
        className="relative z-10 py-5 text-center text-xs text-stone-400"
        style={{ animation: "wave-lift 0.9s ease-in-out 0.45s both" }}
      >
        <p>© 2026 LADTransfer. All rights reserved.</p>
      </footer>

      {/* Requirement 3 Modal: Link New Payment Method */}
      {showAddMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-700 text-white relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowAddMethodModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">
              Link Payment Method
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Add a new card, bank account, or mobile money gateway
            </p>

            <form onSubmit={handleAddPaymentMethod} className="space-y-4">
              {/* Type selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewMethodType("card")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
                    newMethodType === "card"
                      ? "border-[#DFB338] bg-[#DFB338]/10 text-[#DFB338]"
                      : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMethodType("bank")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
                    newMethodType === "bank"
                      ? "border-[#DFB338] bg-[#DFB338]/10 text-[#DFB338]"
                      : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Bank</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMethodType("mobile")}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-colors ${
                    newMethodType === "mobile"
                      ? "border-[#DFB338] bg-[#DFB338]/10 text-[#DFB338]"
                      : "border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Mobile</span>
                </button>
              </div>

              {/* Institution / Provider Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {newMethodType === "card" ? "Card Name / Issuer" : newMethodType === "bank" ? "Bank Name" : "Provider Name"}
                </label>
                <input
                  type="text"
                  required
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  placeholder={newMethodType === "card" ? "e.g. Visa Debit" : newMethodType === "bank" ? "e.g. National Bank of Malawi" : "e.g. Airtel Money"}
                  className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#DFB338] transition-colors placeholder:text-slate-500"
                />
              </div>

              {/* Account / Card Number + CVV Row */}
              <div className={newMethodType === "card" ? "grid grid-cols-3 gap-3" : "space-y-1.5"}>
                <div className={newMethodType === "card" ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
                  <label className="text-xs font-semibold text-slate-300">
                    {newMethodType === "card" ? "Card Number" : newMethodType === "bank" ? "Account Number" : "Phone Number"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newMethodNumber}
                    onChange={(e) => setNewMethodNumber(e.target.value)}
                    placeholder={newMethodType === "card" ? "XXXX XXXX XXXX 4321" : newMethodType === "bank" ? "1002938481" : "+265 99 123 4567"}
                    className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#DFB338] transition-colors placeholder:text-slate-500 font-mono"
                  />
                </div>

                {newMethodType === "card" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">
                      CVV / CVC
                    </label>
                    <input
                      type="password"
                      maxLength={3}
                      required
                      value={newMethodCvv}
                      onChange={(e) => setNewMethodCvv(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                      placeholder="123"
                      className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-[#DFB338] transition-colors placeholder:text-slate-500 font-mono text-center tracking-widest"
                    />
                  </div>
                )}
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isAddingMethod}
                  className="w-full py-3 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-950 text-sm shadow-md hover:brightness-105 transition-all active:scale-[0.99] disabled:opacity-50"
                >
                  {isAddingMethod ? "Saving Method..." : "Save Payment Method"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-700 text-white relative animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setShowEditProfileModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">Edit Profile</h3>
            <p className="text-xs text-slate-400 mb-5">
              Update your contact info and personal preferences
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Full Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#DFB338]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Phone Number</label>
                <input
                  type="text"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#DFB338]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Country</label>
                  <div className="relative">
                    <select
                      value={editFormData.country}
                      onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                      className="w-full appearance-none bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:border-[#DFB338] cursor-pointer"
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.name} className="bg-[#0B1528] text-white">
                          {c.flag} {c.name} ({c.code})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Preferred Currency</label>
                  <div className="relative">
                    <select
                      value={editFormData.currency}
                      onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                      className="w-full appearance-none bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 pr-8 text-sm focus:outline-none focus:border-[#DFB338] cursor-pointer"
                    >
                      {CURRENCY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code} className="bg-[#0B1528] text-white">
                          {c.flag} {c.code} — {c.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="w-full py-3 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-950 text-sm shadow-md hover:brightness-105 transition-all disabled:opacity-50"
                >
                  {isSavingProfile ? "Saving Changes..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
