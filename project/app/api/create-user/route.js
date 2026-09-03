import { createClient } from "@supabase/supabase-js";

function decodeJwtPayload(token) {
  try {
    const payload = token.split(".")[1];
    const json = Buffer.from(payload, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

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
      return Response.json(
        { error: "الخادم غير مهيأ بعد (SUPABASE_SERVICE_ROLE_KEY غير موجود في إعدادات Vercel)" },
        { status: 500 }
      );
    }

    // تحقق من هوية صاحب الطلب
    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return Response.json(
        {
          error: "جلسة غير صالحة",
          detail: userError?.message || null,
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!anonKey,
        },
        { status: 401 }
      );
    }
    const callerEmail = userData.user.email;

    const admin = createClient(supabaseUrl, serviceKey);

    // تأكد إن صاحب الطلب Developer فعلاً
    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles")
      .select("role")
      .eq("email", callerEmail)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "DEVELOPER") {
      return Response.json(
        {
          error: "هذه العملية متاحة للمطوّر فقط",
          callerEmail,
          callerProfile,
          callerProfileError: callerProfileError?.message || null,
          serviceKeyInfo: decodeJwtPayload(serviceKey),
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email: rawEmail, password, role, name } = body;
    const email = String(rawEmail || "").trim().toLowerCase();
    if (!email || !password || !role) {
      return Response.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return Response.json({ error: createError.message }, { status: 400 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .upsert(
        { email, role, name: name || null, status: "ACTIVE", user_id: createdUser?.user?.id || null },
        { onConflict: "email" }
      );

    if (profileError) {
      return Response.json({ error: profileError.message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "خطأ غير متوقع" }, { status: 500 });
  }
}
