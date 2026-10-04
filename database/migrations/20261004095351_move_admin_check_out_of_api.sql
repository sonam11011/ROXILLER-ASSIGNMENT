/*
# Move Admin Check Out of Public API

1. Purpose
- Keep the role check available to row-level security without exposing it as a remotely callable database endpoint.

2. Changes
- Add a private schema function for administrator checks.
- Update store and profile policies to use the private helper.
- Remove execution privileges from the old public helper.

3. Security
- The administrator check can still protect policies, but browser clients cannot invoke it through the Data API.
- No tables, rows, or user records are removed.
*/

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_admin()
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

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM anon;
REVOKE ALL ON FUNCTION private.is_admin() FROM authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
REVOKE ALL ON FUNCTION public.is_admin() FROM authenticated;

DROP POLICY IF EXISTS "Profiles are visible to self or admins" ON public.profiles;
CREATE POLICY "Profiles are visible to self or admins" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR private.is_admin());

DROP POLICY IF EXISTS "Admins can add stores" ON public.stores;
CREATE POLICY "Admins can add stores" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

DROP POLICY IF EXISTS "Admins can remove stores" ON public.stores;
CREATE POLICY "Admins can remove stores" ON public.stores
  FOR DELETE TO authenticated
  USING (private.is_admin());

DROP POLICY IF EXISTS "Admins or owners can update stores" ON public.stores;
CREATE POLICY "Admins or owners can update stores" ON public.stores
  FOR UPDATE TO authenticated
  USING (private.is_admin() OR owner_id = auth.uid())
  WITH CHECK (private.is_admin() OR owner_id = auth.uid());