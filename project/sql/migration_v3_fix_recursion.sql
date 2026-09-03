-- ============================================================
-- إصلاح: حلقة لا نهائية (Infinite Recursion) في صلاحيات جدول profiles
-- شغّل هذا الملف كامل في Supabase > SQL Editor
-- ============================================================

-- دالة تتحقق من صلاحيتك بدون ما تسبب حلقة لا نهائية
-- (SECURITY DEFINER معناها إنها بتشتغل بصلاحية كاملة على الجدول من غير ما
-- تفعّل نفس قواعد RLS اللي إحنا بنكتبها، فمفيش تكرار)
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where email = auth.jwt() ->> 'email';
$$;

-- امسح القاعدتين القديمتين اللي فيهم المشكلة
drop policy if exists "read own profile or developer reads all" on profiles;
drop policy if exists "developer manages profiles" on profiles;

-- أعد إنشاءهم باستخدام الدالة بدل الاستعلام المباشر على نفس الجدول
create policy "read own profile or developer reads all" on profiles
  for select to authenticated
  using (
    email = auth.jwt() ->> 'email'
    or public.get_my_role() = 'DEVELOPER'
  );

create policy "developer manages profiles" on profiles
  for all to authenticated
  using (public.get_my_role() = 'DEVELOPER')
  with check (public.get_my_role() = 'DEVELOPER');
