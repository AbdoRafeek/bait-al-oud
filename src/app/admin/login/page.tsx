
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  Gem,
} from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setLoading(true);

    const supabase = createClient();

    try {
      // 1. Sign in
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError || !data.user) {
        setError("Invalid email or password.");
        return;
      }

      // 2. Check admin role
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

      if (
        profileError ||
        !profile ||
        !["owner", "admin", "manager"].includes(profile.role)
      ) {
        await supabase.auth.signOut();
        setError("You don't have permission to access the admin dashboard.");
        return;
      }

      // 3. Redirect to dashboard
      router.replace("/admin");
      router.refresh();

    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#11100F] flex items-center justify-center px-5 py-12">

      <div className="w-full max-w-md">

        {/* BRAND */}
        <div className="text-center mb-10">

          <div className="w-16 h-16 rounded-full border border-[#C6A568]/40 bg-[#C6A568]/10 flex items-center justify-center mx-auto mb-5">
            <Gem size={30} className="text-[#C6A568]" />
          </div>

          <h1 className="text-3xl font-serif tracking-[3px] text-[#C6A568]">
            BAIT AL OUD
          </h1>

          <p className="text-gray-500 text-xs tracking-[5px] mt-3">
            ADMINISTRATION
          </p>

        </div>

        {/* LOGIN CARD */}
        <div className="bg-[#1B1917] border border-white/10 rounded-2xl p-7 md:p-9 shadow-2xl">

          <div className="mb-8">
            <h2 className="text-2xl font-serif">
              Welcome Back
            </h2>

            <p className="text-gray-500 text-sm mt-2">
              Sign in to manage your store.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* EMAIL */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Email Address
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  autoComplete="username"
                  className="w-full bg-[#11100F] border border-white/10 rounded-lg py-3.5 pl-12 pr-4 outline-none focus:border-[#C6A568] transition text-white"
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#11100F] border border-white/10 rounded-lg py-3.5 pl-12 pr-12 outline-none focus:border-[#C6A568] transition text-white"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-[#C6A568]"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* ERROR */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#C6A568] text-black font-medium py-3.5 rounded-lg flex items-center justify-center gap-2 hover:bg-[#D8B97E] transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={19} className="animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>

          </form>

          <div className="border-t border-white/10 mt-7 pt-6 text-center">
            <p className="text-xs text-gray-600">
              Authorized personnel only.
            </p>
          </div>

        </div>

        <p className="text-center text-xs text-gray-700 mt-8">
          © BAIT AL OUD. ALL RIGHTS RESERVED.
        </p>

      </div>
    </main>
  );
}
