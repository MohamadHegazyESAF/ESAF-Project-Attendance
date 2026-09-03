-- ============================================================
-- شغّل هذا الملف في Supabase > SQL Editor
-- طلبات إنشاء الحساب الذاتي (Sign Up) + صلاحياتها
-- ============================================================

create table if not exists signup_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  employee_number text,
  user_id uuid,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  requested_at timestamptz default now()
);

alter table signup_requests enable row level security;

-- أي حد عمل حساب Auth لتوّه يقدر يبعت طلب مراجعة
create policy "authenticated can create signup request" on signup_requests
  for insert to authenticated
  with check (true);

-- المطوّر بس يشوف/يعدّل/يمسح الطلبات
create policy "developer reads signup requests" on signup_requests
  for select to authenticated
  using (public.get_my_role() = 'DEVELOPER');

create policy "developer updates signup requests" on signup_requests
  for update to authenticated
  using (public.get_my_role() = 'DEVELOPER')
  with check (public.get_my_role() = 'DEVELOPER');

create policy "developer deletes signup requests" on signup_requests
  for delete to authenticated
  using (public.get_my_role() = 'DEVELOPER');

grant select, insert, update, delete on public.signup_requests to authenticated;
grant select, insert, update, delete on public.signup_requests to service_role;
