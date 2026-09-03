-- ============================================================
-- إصلاح إضافي: تبسيط صلاحية قراءة جدول profiles
-- شغّل هذا الملف في Supabase > SQL Editor
-- ============================================================

-- تأكيد صلاحية تنفيذ الدالة (احتياطي)
grant execute on function public.get_my_role() to authenticated;

-- امسح قاعدة القراءة المعقّدة اللي كانت بترجع 403
drop policy if exists "read own profile or developer reads all" on profiles;

-- أي مستخدم مسجّل دخول يقدر يقرأ الجدول كامل (زي باقي الجداول بالظبط)
create policy "any authenticated user can read profiles" on profiles
  for select to authenticated
  using (true);

-- التعديل (إضافة/تغيير مستخدمين) يفضل محصور على الـ Developer فقط
-- (القاعدة دي موجودة بالفعل من قبل، السطر ده للتأكيد بس)
drop policy if exists "developer manages profiles" on profiles;
create policy "developer manages profiles" on profiles
  for all to authenticated
  using (public.get_my_role() = 'DEVELOPER')
  with check (public.get_my_role() = 'DEVELOPER');
