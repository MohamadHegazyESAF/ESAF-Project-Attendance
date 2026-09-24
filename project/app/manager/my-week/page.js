"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const STATUS_ORDER = ["OFFICE", "WFH", "LEAVE"];
const STATUS_LABELS = { OFFICE: "الشركة", WFH: "من المنزل", LEAVE: "إجازة" };
const ALLOWED_ROLES = ["MANAGER", "DEVELOPER"];

function nextSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function MyWeekPage() {
  const router = useRouter();
  const [email, setEmail] = useState(null);
  const [role, setRole] = useState(null);
  const [weekStart, setWeekStart] = useState(nextSunday());
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState(null);
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
    const { data: myRow } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_email", email)
      .maybeSingle();
    setMe(myRow || null);
    if (!myRow) return;

    if (myRow.route_id) {
      const { data: rt } = await supabase.from("routes").select("*").eq("id", myRow.route_id).maybeSingle();
      setRoute(rt || null);
    }

    const map = {};
    for (let i = 0; i < 5; i++) map[i] = { status: "OFFICE", updated_by: null };
    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", myRow.id)
      .eq("week_start", weekStart);
    (att || []).forEach((a) => {
      map[a.day_index] = { status: a.status, updated_by: a.updated_by || null };
    });
    setAttendance(map);
  }, [email, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function cycle(dayIndex) {
    if (!me) return;
    const current = attendance[dayIndex]?.status || "OFFICE";
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(current) + 1) % STATUS_ORDER.length];
    setAttendance((prev) => ({ ...prev, [dayIndex]: { status: next, updated_by: email } }));
    setSaving(true);
    await supabase.from("attendance").upsert(
      { employee_id: me.id, week_start: weekStart, day_index: dayIndex, status: next, updated_by: email },
      { onConflict: "employee_id,week_start,day_index" }
    );
    setSaving(false);
  }

  function editedByLabel(updatedBy) {
    if (!updatedBy) return null;
    if (updatedBy === email) return "أنت";
    if (me && updatedBy === me.manager_email) return "مديرك";
    return updatedBy;
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
          <a href="/manager/my-week">أسبوعي الشخصي</a>
          {role === "DEVELOPER" && <a href="/developer">لوحة المطوّر</a>}
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        {!me ? (
          <div className="card" style={{ maxWidth: "none" }}>
            <h1>لا توجد بيانات موظف مرتبطة بحسابك</h1>
            <p style={{ fontSize: 14, color: "#4a4740" }}>
              عشان تقدر تسجّل أسبوعك الشخصي، لازم مديرك أو المطوّر يضيفك كموظف ويربط بريدك الإلكتروني
              ببيانات الموظف بتاعتك أول.
            </p>
          </div>
        ) : (
          <>
            <div className="row-between">
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>أسبوعي الشخصي — {me.name}</h1>
                <p className="hint">{route?.name || "بدون خط محدد"}</p>
              </div>
              <div>
                <label>بداية الأسبوع (يوم الأحد)</label>
                <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
              </div>
            </div>

            <table className="grid-table">
              <thead>
                <tr>
                  <th>اليوم</th>
                  <th>الحالة</th>
                  <th>آخر تعديل بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((label, i) => {
                  const st = attendance[i]?.status || "OFFICE";
                  const editedBy = editedByLabel(attendance[i]?.updated_by);
                  return (
                    <tr key={i}>
                      <td>{label}</td>
                      <td>
                        <button className={`status-btn status-${st}`} onClick={() => cycle(i)}>
                          {STATUS_LABELS[st]}
                        </button>
                      </td>
                      <td>
                        <span className="hint">{editedBy || "لم يُدخل بعد"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 10 }}>
              {saving ? "جارٍ الحفظ..." : "كل تغيير يُحفظ تلقائيًا. لو مديرك عدّل يوم بدالك، هيظهرلك هنا."}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
