import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return Response.json({ error: "غير مصرح" }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceKey) {
      return Response.json({ error: "الخادم غير مهيأ بعد" }, { status: 500 });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return Response.json({ error: "جلسة غير صالحة" }, { status: 401 });
    }
    const callerEmail = userData.user.email;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("email", callerEmail)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "DEVELOPER") {
      return Response.json({ error: "هذه العملية متاحة للمطوّر فقط" }, { status: 403 });
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    let userId = body.userId || null;

    if (!email && !userId) {
      return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    if (!userId && email) {
      const { data: prof } = await admin.from("profiles").select("user_id").eq("email", email).maybeSingle();
      userId = prof?.user_id || null;
    }

    if (!userId && email) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email?.toLowerCase() === email);
      userId = found?.id || null;
    }

    if (userId) {
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        return Response.json({ error: deleteAuthError.message }, { status: 400 });
      }
    }

    if (email) {
      await admin.from("profiles").delete().eq("email", email);
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "خطأ غير متوقع" }, { status: 500 });
  }
}
