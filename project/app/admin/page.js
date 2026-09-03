"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const ALLOWED_ROLES = ["ADMIN", "DEVELOPER"];

function nextSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [weekStart, setWeekStart] = useState(nextSunday());
  const [dayIndex, setDayIndex] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [attendance, setAttendance] = useState([]);

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
    const { data: emps } = await supabase.from("employees").select("*").neq("status", "INACTIVE");
    setEmployees(emps || []);
    const { data: rts } = await supabase.from("routes").select("*");
    setRoutes(rts || []);
    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .eq("week_start", weekStart);
    setAttendance(att || []);
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function statusFor(empId) {
    const row = attendance.find((a) => a.employee_id === empId && a.day_index === dayIndex);
    return row ? row.status : "OFFICE";
  }

  const office = employees.filter((e) => statusFor(e.id) === "OFFICE");
  const wfhCount = employees.filter((e) => statusFor(e.id) === "WFH").length;
  const leaveCount = employees.filter((e) => statusFor(e.id) === "LEAVE").length;

  const routeRows = routes.map((r) => {
    const count = office.filter((e) => e.route_id === r.id).length;
    const vehiclesRequired = count === 0 ? 0 : Math.ceil(count / r.capacity);
    const utilization = vehiclesRequired > 0 ? Math.round((count / (vehiclesRequired * r.capacity)) * 100) : 0;
    return { ...r, count, vehiclesRequired, utilization };
  });
  const vehiclesTotal = routeRows.reduce((s, r) => s + r.vehiclesRequired, 0);
  const vehiclesNormal = routes.reduce((s, r) => s + r.vehicles, 0);

  function exportCsv() {
    const rows = [["الخط", "السعة", "عدد الموظفين", "العربيات المطلوبة", "نسبة الإشغال %", "الحالة"]];
    routeRows.forEach((r) => {
      rows.push([r.name, r.capacity, r.count, r.vehiclesRequired, r.utilization, r.count > 0 ? "تشغيل" : "إلغاء"]);
    });
    rows.push([]);
    rows.push(["حاضر بالشركة", office.length, "من المنزل", wfhCount, "إجازة", leaveCount]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transportation_${weekStart}_${DAY_LABELS[dayIndex]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (role === null) return <div className="page-center">جارٍ التحقق...</div>;

  if (!ALLOWED_ROLES.includes(role)) {
    return (
      <div className="page-center">
        <div className="card">
          <h1>غير مصرح</h1>
          <p>هذه الصفحة متاحة لمسؤولي الموارد البشرية والمطوّر فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          <a href="/admin">تقرير المواصلات</a>
          {role === "DEVELOPER" && (
            <>
              <a href="/admin/upload">رفع بيانات الموظفين</a>
              <a href="/developer">لوحة المطوّر</a>
            </>
          )}
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <div className="row-between">
          <div>
            <label>بداية الأسبوع (يوم الأحد)</label>
            <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
          </div>
          <button onClick={exportCsv}>تصدير Excel</button>
        </div>

        <div className="tabs">
          {DAY_LABELS.map((d, i) => (
            <button
              key={d}
              className={i === dayIndex ? "tab active" : "tab"}
              onClick={() => setDayIndex(i)}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="metrics">
          <div className="metric">
            <span>إجمالي الموظفين</span>
            <strong>{employees.length}</strong>
          </div>
          <div className="metric">
            <span>حاضر بالشركة</span>
            <strong>{office.length}</strong>
          </div>
          <div className="metric">
            <span>من المنزل</span>
            <strong>{wfhCount}</strong>
          </div>
          <div className="metric">
            <span>إجازة</span>
            <strong>{leaveCount}</strong>
          </div>
        </div>

        <table className="grid-table">
          <thead>
            <tr>
              <th>الخط</th>
              <th>الموظفون الحاضرون</th>
              <th>سعة العربية</th>
              <th>العربيات المطلوبة</th>
              <th>نسبة الإشغال</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {routeRows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.count}</td>
                <td>{r.capacity}</td>
                <td>
                  {r.vehiclesRequired} / {r.vehicles}
                </td>
                <td>{r.utilization}%</td>
                <td>{r.count > 0 ? "تشغيل" : "إلغاء"}</td>
              </tr>
            ))}
            {routeRows.length === 0 && (
              <tr>
                <td colSpan={6}>لا توجد خطوط بعد.</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="metrics" style={{ marginTop: 16 }}>
          <div className="metric dark">
            <span>إجمالي العربيات المطلوبة</span>
            <strong>{vehiclesTotal}</strong>
          </div>
          <div className="metric">
            <span>العدد الطبيعي (بدون تحسين)</span>
            <strong>{vehiclesNormal}</strong>
          </div>
          <div className="metric good">
            <span>عربيات موفَّرة</span>
            <strong>{Math.max(0, vehiclesNormal - vehiclesTotal)}</strong>
          </div>
        </div>
      </main>
    </div>
  );
}
