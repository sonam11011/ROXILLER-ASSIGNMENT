/*
  Assessment completion: align database validation with the brief and allow
  store owners to see the identities of customers who rated their own stores.
  This migration does not create users or expose privileged service keys.
*/

-- Enforce the required full-name length for new and edited profiles.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_full_name_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_full_name_check CHECK (char_length(full_name) BETWEEN 20 AND 60);

-- Keep trigger-generated profiles valid if an account is created without metadata.
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
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'New member account profile'),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'address', ''), 'Address not provided'),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Store owners may view the profile details of people who rated their stores.
-- The nested rating/store checks are scoped to the currently authenticated owner.
DROP POLICY IF EXISTS "Owners can view their store reviewers" ON public.profiles;
CREATE POLICY "Owners can view their store reviewers" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ratings r
      JOIN public.stores s ON s.id = r.store_id
      WHERE r.user_id = profiles.id
        AND s.owner_id = auth.uid()
    )
  );
