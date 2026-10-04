/*
# Create Store Rating Platform

1. Purpose
- Establish the durable data model for a role-based store rating platform.
- Support system administrators, normal users, and store owners without exposing privilege fields to client updates.

2. New Tables and Columns
- `profiles`
  - `id`: the authenticated user's id.
  - `full_name`, `email`, `address`: account details shown in the application.
  - `role`: immutable application role (`admin`, `user`, or `owner`).
  - `created_at`: account creation timestamp.
- `stores`
  - `id`: store identifier.
  - `name`, `address`: store details.
  - `owner_id`: optional profile responsible for the store.
  - `created_at`: store creation timestamp.
- `ratings`
  - `id`: rating identifier.
  - `store_id`, `user_id`: store and reviewer relationships.
  - `rating`: integer from 1 through 5.
  - `created_at`, `updated_at`: rating timestamps.
  - A unique constraint allows one active rating per user and store.

3. Security
- Enable row-level security on every application table.
- Users can read the store directory and ratings after signing in.
- Users can only create, edit, or remove their own rating and edit their own profile content.
- Store owners can view and update their assigned store and its ratings.
- Administrators can manage stores and view all profiles.
- Role and ownership fields are protected from direct client updates.

4. Important Notes
- New email/password accounts are created as normal users by default.
- An administrator can promote accounts through a trusted administrative workflow later without allowing browser clients to forge roles.
- The trigger creates a profile whenever a new authenticated account is created.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 60),
  email text NOT NULL,
  address text NOT NULL CHECK (char_length(address) BETWEEN 5 AND 400),
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'owner')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 60),
  address text NOT NULL CHECK (char_length(address) BETWEEN 5 AND 400),
  owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ratings_one_per_user_store UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS stores_owner_id_idx ON public.stores(owner_id);
CREATE INDEX IF NOT EXISTS ratings_store_id_idx ON public.ratings(store_id);
CREATE INDEX IF NOT EXISTS ratings_user_id_idx ON public.ratings(user_id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, address, role)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'New member'),
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'address', ''), 'Address not provided'),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are visible to self or admins" ON public.profiles;
CREATE POLICY "Profiles are visible to self or admins" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users can create their own profile" ON public.profiles;
CREATE POLICY "Users can create their own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update their profile details" ON public.profiles;
CREATE POLICY "Users can update their profile details" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Authenticated users can browse stores" ON public.stores;
CREATE POLICY "Authenticated users can browse stores" ON public.stores
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins can add stores" ON public.stores;
CREATE POLICY "Admins can add stores" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins or owners can update stores" ON public.stores;
CREATE POLICY "Admins or owners can update stores" ON public.stores
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR owner_id = auth.uid())
  WITH CHECK (public.is_admin() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can remove stores" ON public.stores;
CREATE POLICY "Admins can remove stores" ON public.stores
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can view ratings" ON public.ratings;
CREATE POLICY "Authenticated users can view ratings" ON public.ratings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can submit their own ratings" ON public.ratings;
CREATE POLICY "Users can submit their own ratings" ON public.ratings
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own ratings" ON public.ratings;
CREATE POLICY "Users can update their own ratings" ON public.ratings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their own ratings" ON public.ratings;
CREATE POLICY "Users can remove their own ratings" ON public.ratings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, email, address) ON public.profiles TO authenticated;

INSERT INTO public.stores (name, address)
SELECT 'Harbor & Pine Market', '18 Westbridge Avenue, North Quarter'
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE name = 'Harbor & Pine Market');

INSERT INTO public.stores (name, address)
SELECT 'The Daily Grind', '42 Meridian Street, Old Town'
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE name = 'The Daily Grind');

INSERT INTO public.stores (name, address)
SELECT 'Juniper Home Goods', '7 Garden Lane, Riverside'
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE name = 'Juniper Home Goods');

INSERT INTO public.stores (name, address)
SELECT 'Northstar Books', '103 Willow Road, Arts District'
WHERE NOT EXISTS (SELECT 1 FROM public.stores WHERE name = 'Northstar Books');