"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    redirectByRole(router);
  }, [router]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
        <label>البريد الإلكتروني</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          required
        />
        <label>كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit">دخول</button>
        <a href="/signup" style={{ marginTop: 12, fontSize: 13, color: "#6b6862", textAlign: "center" }}>
          مستخدم جديد؟ اطلب حساب
        </a>
      </form>
    </div>
  );
}
