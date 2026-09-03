"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const ROLES = ["DEVELOPER", "ADMIN", "MANAGER", "EMPLOYEE"];
const ROLE_LABELS = {
  DEVELOPER: "مطوّر",
  ADMIN: "موارد بشرية (Admin)",
  MANAGER: "مدير",
  EMPLOYEE: "موظف",
};

export default function DeveloperPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [requestRoles, setRequestRoles] = useState({});
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "MANAGER" });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("email", data.session.user.email)
        .maybeSingle();
      setRole(profile && profile.status !== "INACTIVE" ? profile.role : null);
    });
  }, [router]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("role");
    setProfiles(data || []);
  }, []);

  const loadRequests = useCallback(async () => {
    const { data } = await supabase
      .from("signup_requests")
      .select("*")
      .eq("status", "PENDING")
      .order("requested_at");
    setRequests(data || []);
  }, []);

  useEffect(() => {
    if (role === "DEVELOPER") {
      loadProfiles();
      loadRequests();
    }
  }, [role, loadProfiles, loadRequests]);

  async function updateRole(email, newRole) {
    await supabase.from("profiles").update({ role: newRole }).eq("email", email);
    loadProfiles();
  }

  async function callDeleteUser({ email, userId }) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch("/api/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, userId }),
    });
    return res.json();
  }

  async function handleStatusChange(p, value) {
    if (value === "REMOVE") {
      if (!confirm(`متأكد إنك عايز تحذف حساب ${p.email} نهائيًا؟ ده هيمسح تسجيل دخوله بالكامل.`)) return;
      const json = await callDeleteUser({ email: p.email, userId: p.user_id });
      if (json.error) {
        setMessage({ ok: false, text: json.error });
      } else {
        setMessage({ ok: true, text: `تم حذف حساب ${p.email}.` });
        loadProfiles();
      }
      return;
    }
    await supabase.from("profiles").update({ status: value }).eq("email", p.email);
    loadProfiles();
  }

  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch("/api/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: json.error || "حدث خطأ" });
    } else {
      setMessage({ ok: true, text: `تم إنشاء حساب ${form.email} بصلاحية ${ROLE_LABELS[form.role]}.` });
      setForm({ email: "", password: "", name: "", role: "MANAGER" });
      loadProfiles();
    }
  }

  async function approveRequest(reqRow) {
    const chosenRole = requestRoles[reqRow.id] || "EMPLOYEE";
    await supabase
      .from("profiles")
      .upsert(
        { email: reqRow.email, role: chosenRole, status: "ACTIVE", user_id: reqRow.user_id },
        { onConflict: "email" }
      );
    if (reqRow.employee_number) {
      await supabase
        .from("employees")
        .update({ employee_email: reqRow.email })
        .eq("employee_number", reqRow.employee_number);
    }
    await supabase.from("signup_requests").update({ status: "APPROVED" }).eq("id", reqRow.id);
    setMessage({ ok: true, text: `تم قبول طلب ${reqRow.email} بصلاحية ${ROLE_LABELS[chosenRole]}.` });
    loadRequests();
    loadProfiles();
  }

  async function rejectRequest(reqRow) {
    if (!confirm(`متأكد إنك عايز ترفض طلب ${reqRow.email}؟ هيتم حذف حسابه.`)) return;
    const json = await callDeleteUser({ email: reqRow.email, userId: reqRow.user_id });
    if (json.error) {
      setMessage({ ok: false, text: json.error });
      return;
    }
    await supabase.from("signup_requests").update({ status: "REJECTED" }).eq("id", reqRow.id);
    setMessage({ ok: true, text: `تم رفض طلب ${reqRow.email}.` });
    loadRequests();
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (role === null) return <div className="page-center">جارٍ التحقق...</div>;

  if (role !== "DEVELOPER") {
    return (
      <div className="page-center">
        <div className="card">
          <h1>غير مصرح</h1>
          <p>هذه الصفحة متاحة للمطوّر فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          <a href="/developer">لوحة المطوّر</a>
          <a href="/developer/routes">إدارة الخطوط</a>
          <a href="/manager">معاينة: شاشة المدير</a>
          <a href="/admin">معاينة: تقرير المواصلات</a>
          <a href="/admin/upload">معاينة: رفع البيانات</a>
          <a href="/employee">معاينة: شاشة الموظف</a>
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>إدارة المستخدمين والصلاحيات</h1>

        {message && (
          <p style={{ marginBottom: 16, color: message.ok ? "#0f6e56" : "#b3261e", fontSize: 14 }}>{message.text}</p>
        )}

        {requests.length > 0 && (
          <div className="card" style={{ maxWidth: "none", marginBottom: 24 }}>
            <h1 style={{ fontSize: 15, marginBottom: 8 }}>طلبات تسجيل جديدة ({requests.length})</h1>
            <table className="grid-table">
              <thead>
                <tr>
                  <th>البريد الإلكتروني</th>
                  <th>رقم الموظف</th>
                  <th>تاريخ الطلب</th>
                  <th>الصلاحية المقترحة</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.email}</td>
                    <td>{r.employee_number || "-"}</td>
                    <td>{new Date(r.requested_at).toLocaleDateString("ar-EG")}</td>
                    <td>
                      <select
                        value={requestRoles[r.id] || "EMPLOYEE"}
                        onChange={(e) => setRequestRoles({ ...requestRoles, [r.id]: e.target.value })}
                        style={{ padding: 6, border: "1px solid #dcd8d0", borderRadius: 8 }}
                      >
                        {ROLES.map((role_) => (
                          <option key={role_} value={role_}>{ROLE_LABELS[role_]}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button
                        onClick={() => approveRequest(r)}
                        style={{ border: "1px solid #cdeadd", background: "#e7f5ee", color: "#0f6e56", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        قبول
                      </button>
                      <button
                        onClick={() => rejectRequest(r)}
                        style={{ border: "1px solid #f0997b", background: "#fff", color: "#b3261e", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        رفض
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card" style={{ maxWidth: "none", marginBottom: 24 }}>
          <h1 style={{ fontSize: 15 }}>إضافة مستخدم جديد</h1>
          <form onSubmit={createUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
            <div>
              <label>البريد الإلكتروني</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label>كلمة المرور المبدئية</label>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "إخفاء" : "إظهار"}
                </button>
              </div>
            </div>
            <div>
              <label>الاسم (اختياري)</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label>الصلاحية</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{ width: "100%", padding: 10, border: "1px solid #dcd8d0", borderRadius: 8 }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{ gridColumn: "1 / -1", background: "#1c1b1a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", width: "fit-content" }}
            >
              {busy ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
            </button>
          </form>
        </div>

        <div className="card" style={{ maxWidth: "none" }}>
          <h1 style={{ fontSize: 15, marginBottom: 8 }}>كل المستخدمين ({profiles.length})</h1>
          <table className="grid-table">
            <thead>
              <tr>
                <th>البريد الإلكتروني</th>
                <th>الاسم</th>
                <th>الصلاحية</th>
                <th>الحالة / إجراء</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => (
                <tr key={p.email}>
                  <td>{p.email}</td>
                  <td>{p.name || "-"}</td>
                  <td>
                    <select
                      value={p.role}
                      onChange={(e) => updateRole(p.email, e.target.value)}
                      style={{ padding: 6, border: "1px solid #dcd8d0", borderRadius: 8 }}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      value={p.status || "ACTIVE"}
                      onChange={(e) => handleStatusChange(p, e.target.value)}
                      style={{
                        padding: 6,
                        border: "1px solid #dcd8d0",
                        borderRadius: 8,
                        color: p.status === "INACTIVE" ? "#854f0b" : "#0f6e56",
                      }}
                    >
                      <option value="ACTIVE">نشط</option>
                      <option value="INACTIVE">غير نشط</option>
                      <option value="REMOVE">حذف الحساب</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
