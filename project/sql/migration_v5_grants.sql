-- ============================================================
-- إصلاح: صلاحيات أساسية (GRANT) صريحة لكل الجداول
-- منفصلة تمامًا عن RLS Policies — دي طبقة تانية لازم تكون موجودة
-- شغّل هذا الملف في Supabase > SQL Editor
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.routes to authenticated;
grant select, insert, update, delete on public.attendance to authenticated;

-- تأكيد صلاحية تنفيذ الدالة كمان
grant execute on function public.get_my_role() to authenticated;
