-- ============================================================
-- شغّل هذا الملف في Supabase > SQL Editor
-- ============================================================

alter table profiles add column if not exists status text not null default 'ACTIVE';
alter table profiles add column if not exists user_id uuid;
