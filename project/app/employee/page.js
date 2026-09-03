"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const STATUS_LABELS = { OFFICE: "الشركة", WFH: "من المنزل", LEAVE: "إجازة" };
const ALLOWED_ROLES = ["EMPLOYEE", "DEVELOPER"];

function nextSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = (7 - day) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default function EmployeePage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [email, setEmail] = useState(null);
  const [weekStart, setWeekStart] = useState(nextSunday());
  const [me, setMe] = useState(null);
  const [route, setRoute] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [routeLoad, setRouteLoad] = useState({});

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

    const { data: rt } = await supabase.from("routes").select("*").eq("id", myRow.route_id).maybeSingle();
    setRoute(rt || null);

    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .eq("employee_id", myRow.id)
      .eq("week_start", weekStart);
    const map = {};
    for (let i = 0; i < 5; i++) map[i] = "OFFICE";
    (att || []).forEach((a) => (map[a.day_index] = a.status));
    setAttendance(map);

    // احسب حالة الخط في الأيام اللي هو حاضر فيها بالشركة
    if (rt) {
      const { data: teamOnRoute } = await supabase
        .from("employees")
        .select("id")
        .eq("route_id", myRow.route_id)
        .neq("status", "INACTIVE");
      const ids = (teamOnRoute || []).map((e) => e.id);
      const { data: allAtt } = await supabase
        .from("attendance")
        .select("*")
        .in("employee_id", ids)
        .eq("week_start", weekStart);

      const load = {};
      for (let i = 0; i < 5; i++) {
        const count = (allAtt || []).filter((a) => a.day_index === i && a.status === "OFFICE").length;
        // الموظفين اللي معندهمش صف = افتراضيًا "الشركة"
        const explicit = new Set((allAtt || []).filter((a) => a.day_index === i).map((a) => a.employee_id));
        const implicitOffice = ids.filter((id) => !explicit.has(id)).length;
        const total = count + implicitOffice;
        load[i] = {
          count: total,
          vehiclesRequired: total === 0 ? 0 : Math.ceil(total / rt.capacity),
        };
      }
      setRouteLoad(load);
    }
  }, [email, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
          <p>هذه الصفحة متاحة للموظفين فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          <a href="/employee">حضوري الأسبوعي</a>
          {role === "DEVELOPER" && <a href="/developer">لوحة المطوّر</a>}
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        {!me ? (
          <div className="card" style={{ maxWidth: "none" }}>
            <h1>لا توجد بيانات مرتبطة بحسابك</h1>
            <p>تواصل مع الموارد البشرية للتأكد من ربط بريدك الإلكتروني ببياناتك.</p>
          </div>
        ) : (
          <>
            <div className="row-between">
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{me.name}</h1>
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
                  <th>خط السير</th>
                  <th>حالة الخط هذا اليوم</th>
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((label, i) => {
                  const st = attendance[i] || "OFFICE";
                  const isOffice = st === "OFFICE";
                  const load = routeLoad[i];
                  return (
                    <tr key={i}>
                      <td>{label}</td>
                      <td>
                        <span className={`status-btn status-${st}`} style={{ display: "inline-block", cursor: "default" }}>
                          {STATUS_LABELS[st]}
                        </span>
                      </td>
                      <td>{isOffice ? route?.name || "-" : "-"}</td>
                      <td>
                        {isOffice && load
                          ? `${load.vehiclesRequired} عربية لخدمة ${load.count} موظف`
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="hint" style={{ marginTop: 10 }}>
              الحضور بيتم إدخاله من طرف مديرك المباشر — لو فيه خطأ، كلّمه لتعديله.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
