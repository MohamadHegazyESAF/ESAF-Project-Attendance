-- ============================================================
-- شغّل هذا الملف كامل مرة واحدة داخل Supabase > SQL Editor
-- ============================================================

create extension if not exists "pgcrypto";

-- 1) جدول الخطوط
create table if not exists routes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  vehicles int not null default 1,
  capacity int not null default 40
);

-- 2) جدول الموظفين
create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_email text not null,
  route_id uuid references routes(id)
);

-- 3) جدول الحضور الأسبوعي
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references employees(id) on delete cascade,
  week_start date not null,
  day_index int not null, -- 0 = السبت ... 4 = الأربعاء
  status text not null default 'OFFICE', -- OFFICE | WFH | LEAVE
  updated_at timestamptz default now(),
  unique (employee_id, week_start, day_index)
);

-- ============================================================
-- الصلاحيات (Row Level Security)
-- ============================================================

alter table routes enable row level security;
alter table employees enable row level security;
alter table attendance enable row level security;

-- أي مستخدم مسجل دخول يقدر يقرأ الخطوط والموظفين وبيانات الحضور
-- (محتاج للتقرير الإجمالي اللي بيجمع كل الخطوط والفرق)
create policy "read routes" on routes
  for select to authenticated using (true);

create policy "read employees" on employees
  for select to authenticated using (true);

create policy "read attendance" on attendance
  for select to authenticated using (true);

-- المدير يقدر يضيف/يعدّل حضور موظفي فريقه فقط
create policy "manager insert own team attendance" on attendance
  for insert to authenticated
  with check (
    exists (
      select 1 from employees e
      where e.id = employee_id
        and e.manager_email = auth.jwt() ->> 'email'
    )
  );

create policy "manager update own team attendance" on attendance
  for update to authenticated
  using (
    exists (
      select 1 from employees e
      where e.id = employee_id
        and e.manager_email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================
-- بيانات تجريبية (احذفها أو عدّلها بعد ما تتأكد إن كل حاجة شغالة)
-- ============================================================

insert into routes (name, vehicles, capacity) values
  ('خط المهندسين', 3, 45),
  ('خط مدينة نصر', 2, 50),
  ('خط 6 أكتوبر', 2, 40),
  ('خط الشروق', 1, 35);

-- عدّل البريد الإلكتروني هنا ليطابق حساب المدير اللي هتنشئه في خطوة
-- Authentication > Users داخل Supabase
insert into employees (name, manager_email, route_id)
select 'أحمد سيد', 'manager1@company.com', id from routes where name = 'خط المهندسين';

insert into employees (name, manager_email, route_id)
select 'محمد جمال', 'manager1@company.com', id from routes where name = 'خط مدينة نصر';

insert into employees (name, manager_email, route_id)
select 'ياسمين طارق', 'manager2@company.com', id from routes where name = 'خط 6 أكتوبر';

insert into employees (name, manager_email, route_id)
select 'عمر رشدي', 'manager2@company.com', id from routes where name = 'خط الشروق';
