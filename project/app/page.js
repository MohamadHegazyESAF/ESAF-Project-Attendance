"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import EyeIcon from "../lib/EyeIcon";

const HOME_BY_ROLE = {
  DEVELOPER: "/developer",
  ADMIN: "/admin",
  MANAGER: "/manager",
  EMPLOYEE: "/employee",
};

async function redirectByRole(router) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const email = data.session.user.email;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("email", email)
    .maybeSingle();

  if (profile && profile.status !== "INACTIVE" && HOME_BY_ROLE[profile.role]) {
    router.push(HOME_BY_ROLE[profile.role]);
    return profile;
  }
  await supabase.auth.signOut();
  return null;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    redirectByRole(router);
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");

    const resolveRes = await fetch("/api/resolve-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier }),
    });
    const resolveJson = await resolveRes.json();
    if (!resolveRes.ok) {
      setError(resolveJson.error || "البريد الإلكتروني أو كود الدخول غير صحيح.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: resolveJson.email,
      password,
    });
    if (error) {
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      return;
    }
    const profile = await redirectByRole(router);
    if (!profile) {
      setError("هذا الحساب غير مفعّل بعد على النظام. تواصل مع المطوّر.");
    }
  }

  return (
    <div className="page-center">
      <form onSubmit={handleLogin} className="card">
        <h1>تسجيل الدخول</h1>
        <label>البريد الإلكتروني أو كود الدخول</label>
        <input
          type="text"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="name@company.com أو كود الدخول"
          required
        />
        <label>كلمة المرور</label>
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          >
            <EyeIcon open={showPassword} />
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit">دخول</button>
        <a href="/signup" style={{ marginTop: 12, fontSize: 13, color: "#6b6862", textAlign: "center" }}>
          مستخدم جديد؟ اطلب حساب
        </a>
      </form>
    </div>
  );
}
