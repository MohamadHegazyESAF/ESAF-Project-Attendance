-- ============================================================
-- إصلاح: صلاحيات service_role الناقصة
-- شغّل هذا الملف في Supabase > SQL Editor
-- ============================================================

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.employees to service_role;
grant select, insert, update, delete on public.routes to service_role;
grant select, insert, update, delete on public.attendance to service_role;
grant execute on function public.get_my_role() to service_role;
