"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

export default function RoutesPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [newRoute, setNewRoute] = useState({ name: "", vehicles: 1, capacity: 40 });
  const [message, setMessage] = useState(null);

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

  const loadRoutes = useCallback(async () => {
    const { data } = await supabase.from("routes").select("*").order("name");
    setRoutes(data || []);
  }, []);

  useEffect(() => {
    if (role === "DEVELOPER") loadRoutes();
  }, [role, loadRoutes]);

  async function addRoute(e) {
    e.preventDefault();
    setMessage(null);
    if (!newRoute.name.trim()) return;
    const { error } = await supabase.from("routes").insert({
      name: newRoute.name.trim(),
      vehicles: Number(newRoute.vehicles) || 1,
      capacity: Number(newRoute.capacity) || 40,
    });
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      setNewRoute({ name: "", vehicles: 1, capacity: 40 });
      loadRoutes();
    }
  }

  async function updateField(id, field, value) {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function saveRoute(route) {
    setMessage(null);
    const { error } = await supabase
      .from("routes")
      .update({
        name: route.name,
        vehicles: Number(route.vehicles) || 1,
        capacity: Number(route.capacity) || 1,
      })
      .eq("id", route.id);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      setMessage({ ok: true, text: `تم حفظ تعديلات "${route.name}".` });
    }
  }

  async function deleteRoute(route) {
    if (!confirm(`متأكد إنك عايز تحذف خط "${route.name}"؟ الموظفون المرتبطون بيه هيبقوا بدون خط.`)) return;
    const { error } = await supabase.from("routes").delete().eq("id", route.id);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      loadRoutes();
    }
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
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>إدارة خطوط المواصلات</h1>

        <div className="card" style={{ maxWidth: "none", marginBottom: 24 }}>
          <h1 style={{ fontSize: 15 }}>إضافة خط جديد</h1>
          <form onSubmit={addRoute} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 12, marginTop: 8, alignItems: "end" }}>
            <div>
              <label>اسم الخط</label>
              <input
                type="text"
                required
                value={newRoute.name}
                onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
              />
            </div>
            <div>
              <label>عدد العربيات</label>
              <input
                type="number"
                min="1"
                value={newRoute.vehicles}
                onChange={(e) => setNewRoute({ ...newRoute, vehicles: e.target.value })}
              />
            </div>
            <div>
              <label>سعة العربية</label>
              <input
                type="number"
                min="1"
                value={newRoute.capacity}
                onChange={(e) => setNewRoute({ ...newRoute, capacity: e.target.value })}
              />
            </div>
            <button
              type="submit"
              style={{ background: "#1c1b1a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", height: "fit-content" }}
            >
              إضافة
            </button>
          </form>
        </div>

        {message && (
          <p style={{ marginBottom: 12, color: message.ok ? "#0f6e56" : "#b3261e", fontSize: 14 }}>{message.text}</p>
        )}

        <table className="grid-table">
          <thead>
            <tr>
              <th>اسم الخط</th>
              <th>عدد العربيات</th>
              <th>سعة العربية</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="text"
                    value={r.name}
                    onChange={(e) => updateField(r.id, "name", e.target.value)}
                    style={{ width: "100%", padding: 6, border: "1px solid #dcd8d0", borderRadius: 6 }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={r.vehicles}
                    onChange={(e) => updateField(r.id, "vehicles", e.target.value)}
                    style={{ width: 70, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, textAlign: "center" }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={r.capacity}
                    onChange={(e) => updateField(r.id, "capacity", e.target.value)}
                    style={{ width: 70, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, textAlign: "center" }}
                  />
                </td>
                <td style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                  <button
                    onClick={() => saveRoute(r)}
                    style={{ border: "1px solid #dcd8d0", background: "#fff", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                  >
                    حفظ
                  </button>
                  <button
                    onClick={() => deleteRoute(r)}
                    style={{ border: "1px solid #f0997b", color: "#b3261e", background: "#fff", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {routes.length === 0 && (
              <tr>
                <td colSpan={4}>لا توجد خطوط بعد — أضف أول خط من الفورم فوق.</td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
