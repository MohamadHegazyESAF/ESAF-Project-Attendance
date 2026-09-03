-- استعلام 1: شوف كل القواعد (Policies) المفعّلة فعليًا على جدول profiles دلوقتي
select policyname, cmd, permissive, roles, qual, with_check
from pg_policies
where tablename = 'profiles';

-- استعلام 2: تأكد هل RLS مفعّل عادي أو بوضع "Force" (بيأثر حتى على المالك)
select relrowsecurity, relforcerowsecurity
from pg_class
where relname = 'profiles';
