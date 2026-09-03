-- ============================================================
-- الترقية الثانية — شغّلها في Supabase > SQL Editor
-- بعد ملف schema.sql الأساسي (المرسل في أول مرة)
-- ============================================================

-- 1) أعمدة جديدة في جدول الموظفين
alter table employees add column if not exists employee_number text;
alter table employees add column if not exists job_grade text;       -- WHITE أو BLUE
alter table employees add column if not exists department text;
alter table employees add column if not exists status text default 'ACTIVE';
alter table employees add column if not exists employee_email text;  -- بريد الموظف نفسه (اختياري لتسجيل دخوله)

create unique index if not exists employees_employee_number_key
  on employees (employee_number);

-- ============================================================
-- 2) جدول الصلاحيات (Roles)
-- ============================================================

create table if not exists profiles (
  email text primary key,
  role text not null check (role in ('DEVELOPER', 'ADMIN', 'MANAGER', 'EMPLOYEE')),
  name text
);

alter table profiles enable row level security;

-- كل مستخدم يقرأ صف نفسه بس (عشان يعرف صلاحيته بعد تسجيل الدخول)
-- والـ Developer يقدر يقرأ كل الصفوف (عشان شاشة إدارة المستخدمين)
create policy "read own profile or developer reads all" on profiles
  for select to authenticated
  using (
    email = auth.jwt() ->> 'email'
    or exists (
      select 1 from profiles p
      where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER'
    )
  );

-- فقط الـ Developer يضيف/يعدّل/يمسح مستخدمين
create policy "developer manages profiles" on profiles
  for all to authenticated
  using (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  )
  with check (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  );

-- ضيف نفسك هنا كأول Developer — غيّر الإيميل والاسم قبل التشغيل
insert into profiles (email, role, name) values
  ('put-your-email-here@company.com', 'DEVELOPER', 'اسمك هنا')
on conflict (email) do nothing;

-- ============================================================
-- 3) فقط الـ Developer يقدر يضيف/يعدّل/يمسح موظفين أو خطوط
-- ============================================================

drop policy if exists "admin manage employees" on employees;
drop policy if exists "admin manage routes" on routes;

create policy "developer manages employees" on employees
  for all to authenticated
  using (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  )
  with check (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  );

create policy "developer manages routes" on routes
  for all to authenticated
  using (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  )
  with check (
    exists (select 1 from profiles p where p.email = auth.jwt() ->> 'email' and p.role = 'DEVELOPER')
  );

-- ============================================================
-- ملاحظة: بعد التشغيل، ضيف صف Profile لكل مدير وموظف عندك
-- (تقدر تعمل ده من شاشة الـ Developer في الموقع نفسه بدل SQL)
-- مثال يدوي لو حبيت:
-- insert into profiles (email, role, name) values ('manager1@company.com','MANAGER','اسم المدير');
-- insert into profiles (email, role, name) values ('hr@company.com','ADMIN','اسم مسؤول الموارد البشرية');
-- ============================================================
