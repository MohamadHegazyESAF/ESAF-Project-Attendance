-- شغّل هذا السطر في Supabase > SQL Editor لتصحيح الإيميل الموجود بحروف كبيرة
update profiles
set email = lower(email)
where email = 'Mohamed.Hegazy@esaf-egypt.com';
