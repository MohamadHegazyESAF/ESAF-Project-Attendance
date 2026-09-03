"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const STATUS_ORDER = ["OFFICE", "WFH", "LEAVE"];
const STATUS_LABELS = { OFFICE: "الشركة", WFH: "من المنزل", LEAVE: "إجازة" };
const ALLOWED_ROLES = ["MANAGER", "DEVELOPER"];

function nextSunday() {
  const d = new Date();
  const day = d.getDay(); // 0 = الأحد
  const diff = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function ManagerPage() {
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [role, setRole] = useState(null);
  const [weekStart, setWeekStart] = useState(nextSunday());
  const [employees, setEmployees] = useState([]);
  const [routes, setRoutes] = useState({});
  const [attendance, setAttendance] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.push("/");
        return;
      }
      const userEmail = data.session.user.email;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("email", userEmail)
        .maybeSingle();
      setRole(profile && profile.status !== "INACTIVE" ? profile.role : null);
      setEmail(userEmail);
    });
  }, [router]);

  const loadData = useCallback(async () => {
    if (!email) return;
    const { data: emps } = await supabase
      .from("employees")
      .select("*")
      .eq("manager_email", email)
      .neq("status", "INACTIVE");
    setEmployees(emps || []);

    const { data: rts } = await supabase.from("routes").select("*");
    const rMap = {};
    (rts || []).forEach((r) => (rMap[r.id] = r));
    setRoutes(rMap);

    const map = {};
    (emps || []).forEach((e) => {
      map[e.id] = {};
      for (let i = 0; i < 5; i++) map[e.id][i] = "OFFICE";
    });

    if (emps && emps.length) {
      const ids = emps.map((e) => e.id);
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .in("employee_id", ids)
        .eq("week_start", weekStart);
      (att || []).forEach((a) => {
        map[a.employee_id][a.day_index] = a.status;
      });
    }
    setAttendance(map);
  }, [email, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function cycle(empId, dayIndex) {
    const current = attendance[empId][dayIndex];
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    setAttendance((prev) => ({ ...prev, [empId]: { ...prev[empId], [dayIndex]: next } }));
    setSaving(true);
    await supabase.from("attendance").upsert(
      { employee_id: empId, week_start: weekStart, day_index: dayIndex, status: next },
      { onConflict: "employee_id,week_start,day_index" }
    );
    setSaving(false);
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
          <p>هذه الصفحة متاحة للمديرين فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          <a href="/manager">شاشة المدير</a>
          {role === "DEVELOPER" && <a href="/developer">لوحة المطوّر</a>}
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <div className="row-between">
          <div>
            <label>بداية الأسبوع (يوم الأحد)</label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
            />
          </div>
          <span className="hint">{saving ? "جارٍ الحفظ..." : "كل تغيير يُحفظ تلقائيًا"}</span>
        </div>

        <table className="grid-table">
          <thead>
            <tr>
              <th>الموظف</th>
              {DAY_LABELS.map((d) => (
                <th key={d}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <div className="emp-name">{emp.name}</div>
                  <div className="emp-route">{routes[emp.route_id]?.name}</div>
                </td>
                {DAY_LABELS.map((_, i) => {
                  const st = attendance[emp.id]?.[i] || "OFFICE";
                  return (
                    <td key={i}>
                      <button className={`status-btn status-${st}`} onClick={() => cycle(emp.id, i)}>
                        {STATUS_LABELS[st]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={6}>لا يوجد موظفون مرتبطون بحسابك بعد. يقدر المطوّر يرفعهم من شيت الإكسيل.</td>
              </tr>
            )}
          </tbody>
        </table>
      </main>
    </div>
  );
}
