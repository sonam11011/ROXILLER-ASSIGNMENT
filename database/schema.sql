-- Roxiller Store Rating Platform
-- PostgreSQL schema for Supabase.
-- Business rules that protect data integrity live here; application workflows live in backend/src/server.js.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 20 and 60),
  email text not null unique check (char_length(email) <= 254),
  address text not null check (char_length(address) between 1 and 400),
  role text not null default 'user' check (role in ('admin','user','owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  address text not null check (char_length(address) between 1 and 400),
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ratings_one_per_user_store unique (store_id, user_id)
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_name_lower_idx on public.profiles(lower(full_name));
create index if not exists profiles_email_lower_idx on public.profiles(lower(email));
create index if not exists profiles_address_lower_idx on public.profiles(lower(address));
create index if not exists stores_name_lower_idx on public.stores(lower(name));
create index if not exists stores_address_lower_idx on public.stores(lower(address));
create index if not exists stores_owner_idx on public.stores(owner_id);
create index if not exists ratings_store_idx on public.ratings(store_id);
create index if not exists ratings_user_idx on public.ratings(user_id);
create index if not exists ratings_store_updated_idx on public.ratings(store_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, address, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), 'New member account profile'),
    coalesce(new.email, ''),
    coalesce(nullif(btrim(new.raw_user_meta_data->>'address'), ''), 'Address not provided'),
    'user'
  )
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

create or replace function public.validate_store_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is not null and not exists (
    select 1 from public.profiles p
    where p.id = new.owner_id and p.role = 'owner'
  ) then
    raise exception 'owner_id must reference a store owner profile';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists stores_updated_at on public.stores;
create trigger stores_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

drop trigger if exists ratings_updated_at on public.ratings;
create trigger ratings_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

drop trigger if exists stores_owner_validation on public.stores;
create trigger stores_owner_validation
before insert or update of owner_id on public.stores
for each row execute function public.validate_store_owner();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.validate_store_owner() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.ratings enable row level security;

drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists stores_authenticated_read on public.stores;
create policy stores_authenticated_read
on public.stores for select
to authenticated
using (true);

drop policy if exists ratings_authenticated_read on public.ratings;
create policy ratings_authenticated_read
on public.ratings for select
to authenticated
using (true);

drop policy if exists ratings_own_insert on public.ratings;
create policy ratings_own_insert
on public.ratings for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists ratings_own_update on public.ratings;
create policy ratings_own_update
on public.ratings for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists ratings_own_delete on public.ratings;
create policy ratings_own_delete
on public.ratings for delete
to authenticated
using ((select auth.uid()) = user_id);

-- The service-role key is server-only. Admin/store-owner authorization is enforced by the Express API.
