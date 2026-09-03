"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const cleanEmail = email.trim().toLowerCase();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
    });

    if (signUpError) {
      setBusy(false);
      setError(signUpError.message || "تعذّر إنشاء الحساب.");
      return;
    }

    const userId = data.user?.id || null;
    const { error: requestError } = await supabase.from("signup_requests").insert({
      email: cleanEmail,
      employee_number: employeeNumber.trim(),
      user_id: userId,
    });

    setBusy(false);
    if (requestError) {
      setError("تم إنشاء الحساب، لكن حصل خطأ في إرسال طلب المراجعة: " + requestError.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="page-center">
        <div className="card">
          <h1>تم إرسال طلبك</h1>
          <p style={{ fontSize: 14, color: "#4a4740" }}>
            هيتم مراجعة طلبك من المطوّر وتفعيل حسابك قريبًا. هتقدر تسجّل دخول بمجرد التفعيل.
          </p>
          <a href="/" style={{ marginTop: 16, fontSize: 13, color: "#1c1b1a" }}>
            الرجوع لتسجيل الدخول
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="page-center">
      <form onSubmit={handleSubmit} className="card">
        <h1>طلب حساب جديد</h1>
        <label>البريد الإلكتروني</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>كلمة المرور</label>
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "إخفاء" : "إظهار"}
          </button>
        </div>
        <label>رقم الموظف</label>
        <input
          type="text"
          value={employeeNumber}
          onChange={(e) => setEmployeeNumber(e.target.value)}
          placeholder="مثال: EMP-1001"
          required
        />
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "جارٍ الإرسال..." : "إرسال الطلب"}
        </button>
        <a href="/" style={{ marginTop: 12, fontSize: 13, color: "#6b6862", textAlign: "center" }}>
          عندك حساب بالفعل؟ سجّل دخول
        </a>
      </form>
    </div>
  );
}
