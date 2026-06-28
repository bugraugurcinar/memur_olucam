-- KPSS Coğrafya Atlas — Supabase şeması (bulut hesap + ilerleme/oyunlaştırma)
-- Supabase panelinde: SQL Editor → bu dosyanın TAMAMINI çalıştır.
-- Bu script idempotent'tir: var olan kurulumda tekrar çalıştırmak güvenlidir
-- (politikalar drop+create ile yeniden kurulur, "already exists" hatası vermez).
-- Ayrıca Authentication → Providers → Email altında "Confirm email" KAPALI olmalı
-- (tek kullanıcı, anında giriş deneyimi için).

-- 1) Profiller: herkese-açık kimlik + XP (liderlik tablosu buradan beslenir)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles read auth" on public.profiles;
create policy "profiles read auth"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 2) Detaylı ilerleme: yalnızca sahibi okur/yazar
create table if not exists public.quiz_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answered integer not null default 0,
  correct integer not null default 0,
  best_streak integer not null default 0,
  by_topic jsonb not null default '{}'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  daily jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.quiz_progress enable row level security;

drop policy if exists "qp select own" on public.quiz_progress;
create policy "qp select own"
  on public.quiz_progress for select
  using (auth.uid() = user_id);

drop policy if exists "qp insert own" on public.quiz_progress;
create policy "qp insert own"
  on public.quiz_progress for insert
  with check (auth.uid() = user_id);

drop policy if exists "qp update own" on public.quiz_progress;
create policy "qp update own"
  on public.quiz_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Yeni kullanıcı kaydolduğunda profili kullanıcı adından otomatik oluştur.
--    Kullanıcı adı çakışırsa kayıt atomik olarak başarısız olur (orphan hesap olmaz).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', 'oyuncu_' || left(new.id::text, 8))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;


create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Backfill: trigger kurulmadan önce kaydolmuş kullanıcılar için eksik
--    profil satırlarını oluştur. Bu satır yoksa XP yazımı (profiles.xp) sessizce
--    başarısız olur ve ilerleme yenilemede kaybolur. Tekrar çalıştırmak güvenlidir.
insert into public.profiles (id, username)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'username', 'oyuncu_' || left(u.id::text, 8))
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
