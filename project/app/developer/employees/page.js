"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const GRADE_LABELS = { WHITE: "White (إداري)", BLUE: "Blue (تنفيذي)" };

const EMPTY_FORM = {
  employee_number: "",
  name: "",
  route_id: "",
  job_grade: "WHITE",
  manager_email: "",
  employee_email: "",
  department: "",
};

export default function EmployeesPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [edits, setEdits] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState("");
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

  const loadData = useCallback(async () => {
    const { data: emps } = await supabase.from("employees").select("*").order("name");
    setEmployees(emps || []);
    const { data: rts } = await supabase.from("routes").select("*").order("name");
    setRoutes(rts || []);
  }, []);

  useEffect(() => {
    if (role === "DEVELOPER") loadData();
  }, [role, loadData]);

  function fieldValue(emp, field) {
    return edits[emp.id]?.[field] ?? emp[field] ?? "";
  }

  function updateField(id, field, value) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function saveEmployee(emp) {
    const patch = edits[emp.id];
    if (!patch) return;
    setMessage(null);
    const { error } = await supabase.from("employees").update(patch).eq("id", emp.id);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      setMessage({ ok: true, text: `تم حفظ بيانات ${emp.name}.` });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[emp.id];
        return next;
      });
      loadData();
    }
  }

  async function deleteEmployee(emp) {
    if (!confirm(`متأكد إنك عايز تحذف الموظف "${emp.name}"؟ هيتشال من كل التقارير والحضور المرتبط بيه.`)) return;
    const { error } = await supabase.from("employees").delete().eq("id", emp.id);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      loadData();
    }
  }

  async function addEmployee(e) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("employees").insert({
      employee_number: form.employee_number.trim() || null,
      name: form.name.trim(),
      route_id: form.route_id || null,
      job_grade: form.job_grade,
      manager_email: form.manager_email.trim().toLowerCase(),
      employee_email: form.employee_email.trim().toLowerCase() || null,
      department: form.department.trim() || null,
      status: "ACTIVE",
    });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: error.message });
    } else {
      setMessage({ ok: true, text: `تم إضافة الموظف ${form.name}.` });
      setForm(EMPTY_FORM);
      loadData();
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

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (e.name || "").toLowerCase().includes(q) ||
      (e.employee_number || "").toLowerCase().includes(q) ||
      (e.manager_email || "").toLowerCase().includes(q) ||
      (e.employee_email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          <a href="/developer">لوحة المطوّر</a>
          <a href="/developer/employees">بيانات الموظفين</a>
          <a href="/developer/routes">إدارة الخطوط</a>
          <a href="/admin/upload">رفع البيانات</a>
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <h1 style={{ marginBottom: 16 }}>بيانات الموظفين ({employees.length})</h1>

        {message && (
          <p style={{ marginBottom: 16, color: message.ok ? "#0f6e56" : "#b3261e", fontSize: 14 }}>{message.text}</p>
        )}

        <div className="card" style={{ maxWidth: "none", marginBottom: 24 }}>
          <h1 style={{ fontSize: 15, marginBottom: 10 }}>إضافة موظف جديد</h1>
          <form onSubmit={addEmployee} style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <div>
              <label>رقم الموظف</label>
              <input
                type="text"
                value={form.employee_number}
                onChange={(e) => setForm({ ...form, employee_number: e.target.value })}
                placeholder="EMP-1001"
              />
            </div>
            <div>
              <label>الاسم</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label>خط السير</label>
              <select
                value={form.route_id}
                onChange={(e) => setForm({ ...form, route_id: e.target.value })}
                required
              >
                <option value="">اختر خط</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>الدرجة الوظيفية</label>
              <select value={form.job_grade} onChange={(e) => setForm({ ...form, job_grade: e.target.value })}>
                <option value="WHITE">White (إداري)</option>
                <option value="BLUE">Blue (تنفيذي)</option>
              </select>
            </div>
            <div>
              <label>بريد المدير المباشر</label>
              <input
                type="email"
                required
                value={form.manager_email}
                onChange={(e) => setForm({ ...form, manager_email: e.target.value })}
              />
            </div>
            <div>
              <label>بريد الموظف (اختياري)</label>
              <input
                type="email"
                value={form.employee_email}
                onChange={(e) => setForm({ ...form, employee_email: e.target.value })}
              />
            </div>
            <div>
              <label>الإدارة (اختياري)</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{ gridColumn: "1 / -1", background: "#1c1b1a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", cursor: "pointer", width: "fit-content" }}
            >
              {busy ? "جارٍ الإضافة..." : "إضافة الموظف"}
            </button>
          </form>
        </div>

        <div className="row-between">
          <div>
            <label>بحث</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم، رقم موظف، أو إيميل..."
              style={{ padding: "9px 12px", border: "1px solid #dcd8d0", borderRadius: 9, fontSize: 14, minWidth: 260 }}
            />
          </div>
          <span className="hint">{filtered.length} من {employees.length} موظف</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="grid-table">
            <thead>
              <tr>
                <th>رقم الموظف</th>
                <th>الاسم</th>
                <th>خط السير</th>
                <th>الدرجة</th>
                <th>بريد المدير</th>
                <th>بريد الموظف</th>
                <th>الإدارة</th>
                <th>الحالة</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const hasEdits = !!edits[emp.id];
                return (
                  <tr key={emp.id}>
                    <td>
                      <input
                        type="text"
                        value={fieldValue(emp, "employee_number")}
                        onChange={(e) => updateField(emp.id, "employee_number", e.target.value)}
                        style={{ width: 90, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={fieldValue(emp, "name")}
                        onChange={(e) => updateField(emp.id, "name", e.target.value)}
                        style={{ width: 140, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <select
                        value={fieldValue(emp, "route_id")}
                        onChange={(e) => updateField(emp.id, "route_id", e.target.value)}
                        style={{ padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      >
                        <option value="">بدون خط</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={fieldValue(emp, "job_grade")}
                        onChange={(e) => updateField(emp.id, "job_grade", e.target.value)}
                        style={{ padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      >
                        <option value="WHITE">White</option>
                        <option value="BLUE">Blue</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="email"
                        value={fieldValue(emp, "manager_email")}
                        onChange={(e) => updateField(emp.id, "manager_email", e.target.value)}
                        style={{ width: 150, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <input
                        type="email"
                        value={fieldValue(emp, "employee_email")}
                        onChange={(e) => updateField(emp.id, "employee_email", e.target.value)}
                        style={{ width: 150, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={fieldValue(emp, "department")}
                        onChange={(e) => updateField(emp.id, "department", e.target.value)}
                        style={{ width: 100, padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      />
                    </td>
                    <td>
                      <select
                        value={fieldValue(emp, "status")}
                        onChange={(e) => updateField(emp.id, "status", e.target.value)}
                        style={{ padding: 6, border: "1px solid #dcd8d0", borderRadius: 6, fontSize: 12 }}
                      >
                        <option value="ACTIVE">نشط</option>
                        <option value="INACTIVE">غير نشط</option>
                      </select>
                    </td>
                    <td style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      <button
                        onClick={() => saveEmployee(emp)}
                        disabled={!hasEdits}
                        style={{
                          border: "1px solid #cdeadd",
                          background: hasEdits ? "#e7f5ee" : "#f5f4f0",
                          color: hasEdits ? "#0f6e56" : "#b3b0a8",
                          borderRadius: 6,
                          padding: "6px 10px",
                          cursor: hasEdits ? "pointer" : "not-allowed",
                          fontSize: 11,
                        }}
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => deleteEmployee(emp)}
                        style={{ border: "1px solid #f0997b", background: "#fff", color: "#b3261e", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 11 }}
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>مفيش موظفين مطابقين.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
