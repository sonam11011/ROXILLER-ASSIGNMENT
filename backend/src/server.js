import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordRe = /^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,16}$/;
const roles = ['admin', 'user', 'owner'];

app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json());

function fail(res, status, error) {
  return res.status(status).json({ error });
}

function validateUser(body, requirePassword = true) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const address = String(body.address ?? '').trim();
  if (name.length < 20 || name.length > 60) return 'Name must be 20–60 characters.';
  if (!emailRe.test(email)) return 'Enter a valid email.';
  if (address.length > 400) return 'Address must be at most 400 characters.';
  if (requirePassword && !passwordRe.test(String(body.password ?? ''))) {
    return 'Password must be 8–16 characters with one uppercase letter and one special character.';
  }
  return null;
}

function cleanSearch(value) {
  return String(value ?? '').replace(/[%,_]/g, '').trim();
}

async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return fail(res, 401, 'Authentication required.');

  const { data, error } = await db.auth.getUser(header.slice(7));
  if (error || !data.user) return fail(res, 401, 'Invalid session.');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id,full_name,email,address,role')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) return fail(res, 403, 'Profile not found.');

  req.user = data.user;
  req.profile = profile;
  next();
}

const role = (...allowed) => (req, res, next) =>
  allowed.includes(req.profile.role) ? next() : fail(res, 403, 'Forbidden.');

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', auth);

app.get('/api/me', (req, res) => res.json({ profile: req.profile }));

app.get('/api/dashboard', role('admin'), async (_req, res) => {
  const [users, stores, ratings] = await Promise.all([
    db.from('profiles').select('*', { count: 'exact', head: true }),
    db.from('stores').select('*', { count: 'exact', head: true }),
    db.from('ratings').select('*', { count: 'exact', head: true }),
  ]);
  if (users.error || stores.error || ratings.error) return fail(res, 500, 'Could not load dashboard.');
  res.json({ users: users.count || 0, stores: stores.count || 0, ratings: ratings.count || 0 });
});

app.get('/api/users', role('admin'), async (req, res) => {
  const allowedSorts = { name: 'full_name', email: 'email', address: 'address', role: 'role', created_at: 'created_at' };
  const sort = allowedSorts[req.query.sort] || 'full_name';
  let query = db.from('profiles').select('id,full_name,email,address,role,created_at').order(sort, {
    ascending: req.query.order !== 'desc',
  });

  for (const [key, column] of [['name', 'full_name'], ['email', 'email'], ['address', 'address']]) {
    const value = cleanSearch(req.query[key]);
    if (value) query = query.ilike(column, '%' + value + '%');
  }
  if (roles.includes(req.query.role)) query = query.eq('role', req.query.role);

  const { data, error } = await query;
  if (error) return fail(res, 500, 'Could not load users.');
  res.json({ users: data || [] });
});

app.post('/api/users', role('admin'), async (req, res) => {
  const validation = validateUser(req.body);
  if (validation) return fail(res, 400, validation);
  if (!roles.includes(req.body.role)) return fail(res, 400, 'Invalid role.');

  const email = String(req.body.email).trim();
  const name = String(req.body.name).trim();
  const address = String(req.body.address).trim();

  const created = await db.auth.admin.createUser({
    email,
    password: req.body.password,
    email_confirm: true,
    user_metadata: { full_name: name, address },
  });
  if (created.error || !created.data.user) return fail(res, 400, created.error?.message || 'Could not create user.');

  const { data, error } = await db.from('profiles')
    .update({ full_name: name, email, address, role: req.body.role })
    .eq('id', created.data.user.id)
    .select('id,full_name,email,address,role')
    .single();

  if (error) return fail(res, 500, 'User was created but the profile could not be configured.');
  res.status(201).json({ user: data });
});

app.get('/api/users/:id', role('admin'), async (req, res) => {
  const { data: user, error } = await db.from('profiles')
    .select('id,full_name,email,address,role,created_at')
    .eq('id', req.params.id)
    .single();

  if (error || !user) return fail(res, 404, 'User not found.');

  let ownerRating = null;
  if (user.role === 'owner') {
    const { data: stores } = await db.from('stores').select('id').eq('owner_id', user.id);
    const storeIds = (stores || []).map((store) => store.id);
    if (storeIds.length) {
      const { data: ratings } = await db.from('ratings').select('rating').in('store_id', storeIds);
      if (ratings?.length) ownerRating = Number((ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length).toFixed(2));
    }
  }
  res.json({ user, owner_rating: ownerRating });
});

app.get('/api/stores', async (req, res) => {
  const allowedSorts = { name: 'name', address: 'address', created_at: 'created_at' };
  const sort = allowedSorts[req.query.sort] || 'name';
  let query = db.from('stores')
    .select('id,name,address,owner_id,created_at')
    .order(sort, { ascending: req.query.order !== 'desc' });

  const search = cleanSearch(req.query.search);
  if (search) query = query.or('name.ilike.%' + search + '%,address.ilike.%' + search + '%');

  const { data: stores, error } = await query;
  if (error) return fail(res, 500, 'Could not load stores.');

  const storeIds = (stores || []).map((store) => store.id);
  const { data: ratings = [] } = storeIds.length
    ? await db.from('ratings').select('id,store_id,user_id,rating,updated_at').in('store_id', storeIds)
    : { data: [] };

  const ownerIds = [...new Set((stores || []).map((store) => store.owner_id).filter(Boolean))];
  const { data: owners = [] } = ownerIds.length
    ? await db.from('profiles').select('id,email,full_name').in('id', ownerIds)
    : { data: [] };
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner]));

  res.json({
    stores: (stores || []).map((store) => {
      const rows = ratings.filter((rating) => rating.store_id === store.id);
      const mine = rows.find((rating) => rating.user_id === req.user.id);
      return {
        ...store,
        owner_email: ownerMap.get(store.owner_id)?.email || null,
        rating: rows.length ? Number((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length).toFixed(2)) : null,
        rating_count: rows.length,
        user_rating: mine?.rating ?? null,
        user_rating_id: mine?.id ?? null,
      };
    }),
  });
});

app.post('/api/stores', role('admin'), async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const address = String(req.body.address ?? '').trim();
  if (name.length < 2 || name.length > 60) return fail(res, 400, 'Store name must be 2–60 characters.');
  if (address.length < 1 || address.length > 400) return fail(res, 400, 'Address must be 1–400 characters.');

  const ownerId = req.body.ownerId || null;
  if (ownerId) {
    const { data: owner } = await db.from('profiles').select('id').eq('id', ownerId).eq('role', 'owner').single();
    if (!owner) return fail(res, 400, 'Selected user is not a store owner.');
  }

  const { data, error } = await db.from('stores')
    .insert({ name, address, owner_id: ownerId })
    .select('id,name,address,owner_id,created_at')
    .single();

  if (error) return fail(res, 400, error.message);
  res.status(201).json({ store: data });
});

app.put('/api/stores/:id', role('admin'), async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const address = String(req.body.address ?? '').trim();
  if (name.length < 2 || name.length > 60) return fail(res, 400, 'Store name must be 2–60 characters.');
  if (address.length < 1 || address.length > 400) return fail(res, 400, 'Address must be 1–400 characters.');

  const ownerId = req.body.ownerId || null;
  if (ownerId) {
    const { data: owner } = await db.from('profiles').select('id').eq('id', ownerId).eq('role', 'owner').single();
    if (!owner) return fail(res, 400, 'Selected user is not a store owner.');
  }

  const { data, error } = await db.from('stores')
    .update({ name, address, owner_id: ownerId })
    .eq('id', req.params.id)
    .select('id,name,address,owner_id,created_at')
    .single();

  if (error || !data) return fail(res, 404, 'Store not found.');
  res.json({ store: data });
});

app.post('/api/ratings', role('user'), async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(res, 400, 'Rating must be between 1 and 5.');

  const { data, error } = await db.from('ratings')
    .upsert({ store_id: req.body.storeId, user_id: req.user.id, rating }, { onConflict: 'store_id,user_id' })
    .select('id,store_id,user_id,rating,created_at,updated_at')
    .single();

  if (error) return fail(res, 400, error.message);
  res.json({ rating: data });
});

app.put('/api/ratings/:id', role('user'), async (req, res) => {
  const rating = Number(req.body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(res, 400, 'Rating must be between 1 and 5.');

  const { data, error } = await db.from('ratings')
    .update({ rating })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id,store_id,user_id,rating,created_at,updated_at')
    .single();

  if (error || !data) return fail(res, 404, 'Rating not found or not owned by the current user.');
  res.json({ rating: data });
});

app.get('/api/owner/dashboard', role('owner'), async (req, res) => {
  const { data: stores = [], error: storeError } = await db.from('stores')
    .select('id,name,address,owner_id')
    .eq('owner_id', req.user.id)
    .order('name');
  if (storeError) return fail(res, 500, 'Could not load owner stores.');

  const storeIds = stores.map((store) => store.id);
  const { data: ratingRows = [] } = storeIds.length
    ? await db.from('ratings').select('id,store_id,user_id,rating,updated_at').in('store_id', storeIds).order('updated_at', { ascending: false })
    : { data: [] };

  const userIds = [...new Set(ratingRows.map((row) => row.user_id))];
  const { data: reviewers = [] } = userIds.length
    ? await db.from('profiles').select('id,full_name,email').in('id', userIds)
    : { data: [] };
  const reviewerMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer]));

  const ratings = ratingRows.map((row) => ({ ...row, reviewer: reviewerMap.get(row.user_id) || null }));
  const resultStores = stores.map((store) => {
    const rows = ratings.filter((rating) => rating.store_id === store.id);
    return {
      ...store,
      rating: rows.length ? Number((rows.reduce((sum, row) => sum + row.rating, 0) / rows.length).toFixed(2)) : null,
      rating_count: rows.length,
    };
  });

  const average = ratings.length
    ? Number((ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length).toFixed(2))
    : null;

  res.json({ stores: resultStores, ratings, average_rating: average });
});

app.patch('/api/profile', async (req, res) => {
  const name = String(req.body.name ?? '').trim();
  const address = String(req.body.address ?? '').trim();
  if (name.length < 20 || name.length > 60) return fail(res, 400, 'Name must be 20–60 characters.');
  if (address.length < 1 || address.length > 400) return fail(res, 400, 'Address must be 1–400 characters.');

  const { data, error } = await db.from('profiles')
    .update({ full_name: name, address })
    .eq('id', req.user.id)
    .select('id,full_name,email,address,role')
    .single();

  if (error) return fail(res, 400, error.message);
  res.json({ profile: data });
});

app.patch('/api/password', async (req, res) => {
  const password = String(req.body.password ?? '');
  if (!passwordRe.test(password)) return fail(res, 400, 'Password must be 8–16 characters with one uppercase letter and one special character.');

  const { error } = await db.auth.admin.updateUserById(req.user.id, { password });
  if (error) return fail(res, 400, 'Password could not be updated.');
  res.json({ ok: true });
});

app.use((_req, res) => fail(res, 404, 'Route not found.'));

app.listen(PORT, () => console.log('Roxiller API running on port ' + PORT));
