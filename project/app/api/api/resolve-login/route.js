import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const body = await req.json();
    const value = String(body.identifier || "").trim();
    if (!value) {
      return Response.json({ error: "أدخل البريد الإلكتروني أو كود الدخول" }, { status: 400 });
    }

    if (value.includes("@")) {
      return Response.json({ email: value.toLowerCase() });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return Response.json({ error: "الخادم غير مهيأ بعد" }, { status: 500 });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data } = await admin
      .from("profiles")
      .select("email")
      .eq("login_code", value)
      .maybeSingle();

    if (!data) {
      return Response.json({ error: "البريد الإلكتروني أو كود الدخول غير صحيح" }, { status: 404 });
    }

    return Response.json({ email: data.email });
  } catch (err) {
    return Response.json({ error: err.message || "خطأ غير متوقع" }, { status: 500 });
  }
}
