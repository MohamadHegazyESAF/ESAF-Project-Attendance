"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { supabase } from "../../../lib/supabaseClient";

const HEADERS = {
  number: "رقم الموظف",
  name: "اسم الموظف",
  route: "خط السير",
  grade: "الدرجة الوظيفية",
  manager: "البريد الإلكتروني للمدير المباشر",
  employeeEmail: "البريد الإلكتروني الخاص بالموظف (اختياري)",
  department: "الإدارة",
  status: "الحالة",
};

function normalizeGrade(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["white", "أبيض", "ابيض", "اداري", "إداري"].includes(s)) return "WHITE";
  if (["blue", "أزرق", "ازرق", "تنفيذي", "ميداني"].includes(s)) return "BLUE";
  return null;
}

function downloadTemplate() {
  const headers = [
    HEADERS.number,
    HEADERS.name,
    HEADERS.route,
    HEADERS.grade,
    HEADERS.manager,
    HEADERS.employeeEmail,
    HEADERS.department,
    HEADERS.status,
  ];
  const example = [
    "EMP-1001",
    "أحمد سيد محمود",
    "خط المهندسين",
    "White",
    "manager1@company.com",
    "ahmed.sayed@company.com",
    "العمليات",
    "نشط",
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "بيانات الموظفين");

  const notes = [
    ["1) الصف الأول ثابت (عناوين الأعمدة) — لا تغيّره ولا تحذفه."],
    ["2) الصف الثاني مثال فقط — استبدله ببيانات حقيقية قبل الرفع."],
    ["3) عمود خط السير لازم يطابق اسم خط موجود بالفعل في النظام بالظبط."],
    ["4) عمود الدرجة الوظيفية: اكتب White (إداري) أو Blue (تنفيذي) فقط."],
    ["5) بريد المدير لازم يطابق نفس بريد حساب المدير المسجل في النظام."],
    ["6) بريد الموظف اختياري — لو موجود، الموظف يقدر يدخل يشوف بياناته بنفسه."],
    ["7) رقم الموظف لازم يكون فريدًا — لو اترفع برقم موجود، بياناته هتتحدّث بدل التكرار."],
    ["8) عمودا الإدارة والحالة اختياريان."],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(notes);
  XLSX.utils.book_append_sheet(wb, ws2, "تعليمات");

  XLSX.writeFile(wb, "employee_upload_template.xlsx");
}

export default function UploadPage() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [rows, setRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [result, setResult] = useState(null);
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

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setResult(null);

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const { data: routeList } = await supabase.from("routes").select("*");
    const routeMap = {};
    (routeList || []).forEach((r) => (routeMap[r.name.trim()] = r.id));

    const parsed = [];
    const errs = [];

    data.forEach((row, i) => {
      const number = String(row[HEADERS.number] || "").trim();
      const name = String(row[HEADERS.name] || "").trim();
      const routeName = String(row[HEADERS.route] || "").trim();
      const grade = normalizeGrade(row[HEADERS.grade]);
      const managerEmail = String(row[HEADERS.manager] || "").trim().toLowerCase();
      const employeeEmail = String(row[HEADERS.employeeEmail] || "").trim().toLowerCase();
      const department = String(row[HEADERS.department] || "").trim();
      const statusRaw = String(row[HEADERS.status] || "نشط").trim();

      const issues = [];
      if (!number) issues.push("رقم الموظف فارغ");
      if (!name) issues.push("اسم الموظف فارغ");
      if (!managerEmail || !managerEmail.includes("@")) issues.push("بريد المدير غير صحيح");
      if (!grade) issues.push("الدرجة الوظيفية لازم تكون White أو Blue");
      if (!routeName || !routeMap[routeName]) issues.push(`خط السير "${routeName}" غير موجود في النظام`);

      if (issues.length) {
        errs.push({ row: i + 2, issues });
      } else {
        parsed.push({
          employee_number: number,
          name,
          route_id: routeMap[routeName],
          job_grade: grade,
          manager_email: managerEmail,
          employee_email: employeeEmail || null,
          department: department || null,
          status: statusRaw.includes("غير") ? "INACTIVE" : "ACTIVE",
        });
      }
    });

    setRows(parsed);
    setErrors(errs);
  }

  async function confirmUpload() {
    setBusy(true);
    const { error } = await supabase
      .from("employees")
      .upsert(rows, { onConflict: "employee_number" });
    setBusy(false);
    if (error) {
      setResult({ ok: false, message: error.message });
    } else {
      setResult({ ok: true, message: `تم رفع ${rows.length} موظف بنجاح.` });
      setRows([]);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (role === null) return <div className="page-center">جارٍ التحقق...</div>;

  if (!["ADMIN", "DEVELOPER"].includes(role)) {
    return (
      <div className="page-center">
        <div className="card">
          <h1>غير مصرح</h1>
          <p>هذه الصفحة متاحة للموارد البشرية والمطوّر فقط.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="topbar">
        <span className="brand">مخطط الحضور والمواصلات</span>
        <nav>
          {role === "ADMIN" && <a href="/admin">تقرير المواصلات</a>}
          {role === "DEVELOPER" && (
            <>
              <a href="/admin">تقرير المواصلات</a>
              <a href="/admin/upload">رفع بيانات الموظفين</a>
              <a href="/developer">لوحة المطوّر</a>
            </>
          )}
          <button onClick={logout}>خروج</button>
        </nav>
      </header>
      <main>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>بيانات الموظفين</h1>

        <div className="card" style={{ maxWidth: "none", marginBottom: 20 }}>
          <h1 style={{ fontSize: 15 }}>الخطوة ١: نزّل نموذج القالب</h1>
          <p style={{ fontSize: 13, color: "#6b6862", margin: "4px 0 12px" }}>
            نموذج إكسيل فيه الأعمدة المطلوبة ومثال وتعليمات. املأه ببيانات موظفيك الحقيقية.
          </p>
          <button onClick={downloadTemplate} style={{ width: "fit-content" }}>
            تحميل نموذج القالب
          </button>
        </div>

        {role === "DEVELOPER" && (
          <div className="card" style={{ maxWidth: "none" }}>
            <h1 style={{ fontSize: 15 }}>الخطوة ٢: ارفع الملف بعد ملئه</h1>
            <p style={{ fontSize: 13, color: "#6b6862", margin: "4px 0 12px" }}>
              خط السير لازم يكون موجود بالفعل في جدول الخطوط، وبريد المدير لازم يطابق حساب مسجل.
            </p>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} />

            {errors.length > 0 && (
              <div style={{ marginTop: 16, borderTop: "1px solid #f0eee9", paddingTop: 12 }}>
                <p style={{ color: "#b3261e", fontSize: 13, fontWeight: 600 }}>
                  صفوف بها أخطاء ({errors.length}) — لن تُرفع
                </p>
                <ul style={{ margin: 0, paddingRight: 18, fontSize: 13 }}>
                  {errors.map((e) => (
                    <li key={e.row}>الصف {e.row}: {e.issues.join("، ")}</li>
                  ))}
                </ul>
              </div>
            )}

            {rows.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: 13, color: "#6b6862" }}>{rows.length} صف جاهز للرفع (معاينة):</p>
                <table className="grid-table">
                  <thead>
                    <tr>
                      <th>رقم الموظف</th>
                      <th>الاسم</th>
                      <th>الدرجة</th>
                      <th>المدير</th>
                      <th>الإدارة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 25).map((r) => (
                      <tr key={r.employee_number}>
                        <td>{r.employee_number}</td>
                        <td>{r.name}</td>
                        <td>{r.job_grade}</td>
                        <td>{r.manager_email}</td>
                        <td>{r.department || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={confirmUpload}
                  disabled={busy}
                  style={{
                    marginTop: 12,
                    background: "#1c1b1a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 20px",
                    cursor: "pointer",
                  }}
                >
                  {busy ? "جارٍ الرفع..." : `تأكيد رفع ${rows.length} موظف`}
                </button>
              </div>
            )}

            {result && (
              <p style={{ marginTop: 16, color: result.ok ? "#0f6e56" : "#b3261e", fontSize: 14 }}>
                {result.message}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
