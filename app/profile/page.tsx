"use client";

import { useState, useRef, ChangeEvent } from "react";
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
  Lock
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

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
    name: "Michael Wright",
    email: "michael.wright@email.com",
    accountId: "LAD-12345-6789",
    phone: "+123456789",
    country: "Malawi",
    currency: "MWK",
  });

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  
  // Payment methods state (Requirement 3)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: "pm-1",
      type: "card",
      title: "Mastercard",
      subtitle: "**** 1234",
      iconType: "card",
    },
    {
      id: "pm-2",
      type: "bank",
      title: "Malawi Savings Bank",
      subtitle: "**** 5678",
      iconType: "bank",
    },
  ]);

  // Modals state
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ ...profileData });

  // Add Method Form State
  const [newMethodType, setNewMethodType] = useState<"card" | "bank" | "mobile">("card");
  const [newMethodName, setNewMethodName] = useState("");
  const [newMethodNumber, setNewMethodNumber] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddPaymentMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMethodName || !newMethodNumber) return;

    const last4 = newMethodNumber.slice(-4) || "0000";
    const newMethod: PaymentMethod = {
      id: `pm-${Date.now()}`,
      type: newMethodType,
      title: newMethodName,
      subtitle: `**** ${last4}`,
      iconType: newMethodType,
    };

    setPaymentMethods([...paymentMethods, newMethod]);
    setShowAddMethodModal(false);
    setNewMethodName("");
    setNewMethodNumber("");
  };

  const handleRemovePaymentMethod = (id: string) => {
    setPaymentMethods(paymentMethods.filter((pm) => pm.id !== id));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileData({ ...editFormData });
    setShowEditProfileModal(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-stone-900 flex flex-col justify-between relative overflow-hidden font-sans">
      {/* Subtle Background Glows */}
      <div className="absolute top-0 left-1/3 w-[600px] h-[350px] bg-blue-500/[0.06] rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[350px] bg-[#C9A227]/[0.07] rounded-full blur-[140px] pointer-events-none" />

      {/* Consistent Top Navigation Header */}
      <AppHeader active="profile" />

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-4xl mx-auto flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-10">
        <div className="w-full space-y-6">
          
          {/* Top Profile Summary Card */}
          <div className="bg-[#0B1528] rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 text-white relative overflow-hidden">
            {/* Subtle card glow */}
            <div className="absolute -top-24 right-10 w-64 h-64 bg-[#C9A227]/10 rounded-full blur-[70px] pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
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
                    <div className="w-full h-full rounded-full bg-[#131F37] flex items-center justify-center text-4xl sm:text-5xl font-extrabold text-[#DFB338]">
                      MW
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
                    <p className="text-sm text-slate-400 font-medium">
                      {profileData.email}
                    </p>
                  </div>

                  {/* Account Status Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-semibold self-center sm:self-start shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Account status: Verified</span>
                  </div>
                </div>

                {/* Account ID Pill with Copy */}
                <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
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
            </div>
          </div>

          {/* Details Row: Phone, Country, Preferred Currency */}
          <div className="bg-[#0B1528] rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 text-white">
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
                  <span>🇲🇼</span>
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
          <div className="bg-[#0B1528] rounded-3xl p-6 sm:p-7 shadow-xl border border-slate-800 text-white">
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

            {/* Methods Grid */}
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
          </div>

          {/* Bottom Action: Edit Profile CTA */}
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                setEditFormData({ ...profileData });
                setShowEditProfileModal(true);
              }}
              className="w-full sm:w-auto min-w-[220px] py-3.5 px-8 rounded-2xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] hover:from-[#e5bc42] hover:to-[#c49a21] font-bold text-stone-900 shadow-[0_6px_20px_rgba(201,162,39,0.3)] hover:shadow-[0_8px_25px_rgba(201,162,39,0.45)] active:scale-[0.99] transition-all text-base flex items-center justify-center gap-2"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-5 text-center text-xs text-stone-400">
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

              {/* Account / Card Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  {newMethodType === "card" ? "Card Number" : newMethodType === "bank" ? "Account Number" : "Phone Number"}
                </label>
                <input
                  type="text"
                  required
                  value={newMethodNumber}
                  onChange={(e) => setNewMethodNumber(e.target.value)}
                  placeholder={newMethodType === "card" ? "XXXX XXXX XXXX 4321" : newMethodType === "bank" ? "1002938481" : "+265 99 123 4567"}
                  className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#DFB338] transition-colors placeholder:text-slate-500"
                />
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-950 text-sm shadow-md hover:brightness-105 transition-all active:scale-[0.99]"
                >
                  Save Payment Method
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
                  <input
                    type="text"
                    value={editFormData.country}
                    onChange={(e) => setEditFormData({ ...editFormData, country: e.target.value })}
                    className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#DFB338]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Preferred Currency</label>
                  <input
                    type="text"
                    value={editFormData.currency}
                    onChange={(e) => setEditFormData({ ...editFormData, currency: e.target.value })}
                    className="w-full bg-[#131F37] border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#DFB338]"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-b from-[#DFB338] to-[#B8911E] font-bold text-stone-950 text-sm shadow-md hover:brightness-105 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
