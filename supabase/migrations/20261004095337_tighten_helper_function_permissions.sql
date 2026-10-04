/*
# Tighten Helper Function Permissions

1. Purpose
- Remove direct API execution rights from internal trigger and authorization helpers.

2. Changes
- `handle_new_user()` remains available to the authentication trigger only and is no longer callable through the public Data API.
- `is_admin()` remains available to signed-in application requests but is not callable by anonymous visitors.

3. Security
- Revoke inherited PUBLIC execution rights before granting only the role required by each function.
- No tables or user data are removed or changed.
*/

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;