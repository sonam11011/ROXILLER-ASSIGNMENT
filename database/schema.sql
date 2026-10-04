-- Roxiller FullStack Intern Coding Challenge
-- PostgreSQL schema for Supabase.

create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 20 and 60),
  email text not null,
  address text not null check (char_length(address) between 1 and 400),
  role text not null default 'user' check (role in ('admin','user','owner')),
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  address text not null check (char_length(address) between 1 and 400),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_one_per_user_store unique (store_id,user_id)
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_name_idx on public.profiles(full_name);
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists stores_name_idx on public.stores(name);
create index if not exists stores_owner_idx on public.stores(owner_id);
create index if not exists ratings_store_idx on public.ratings(store_id);
create index if not exists ratings_user_idx on public.ratings(user_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,email,address,role)
  values(
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''),'New member account profile'),
    coalesce(new.email,''),
    coalesce(nullif(new.raw_user_meta_data->>'address',''),'Address not provided'),
    'user'
  ) on conflict(id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.ratings enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles for select to authenticated using(id=auth.uid());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists stores_authenticated_read on public.stores;
create policy stores_authenticated_read on public.stores for select to authenticated using(true);

drop policy if exists ratings_authenticated_read on public.ratings;
create policy ratings_authenticated_read on public.ratings for select to authenticated using(true);

drop policy if exists ratings_own_insert on public.ratings;
create policy ratings_own_insert on public.ratings for insert to authenticated with check(user_id=auth.uid());

drop policy if exists ratings_own_update on public.ratings;
create policy ratings_own_update on public.ratings for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

drop policy if exists ratings_own_delete on public.ratings;
create policy ratings_own_delete on public.ratings for delete to authenticated using(user_id=auth.uid());

-- After creating the first account, promote it once:
-- update public.profiles set role='admin' where email='your-admin@example.com';
