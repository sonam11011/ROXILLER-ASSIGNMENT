# Roxiller Store Rating Platform

Full-stack implementation of the Roxiller FullStack Intern Coding Challenge.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Express.js REST API
- Database: PostgreSQL through Supabase
- Authentication: Supabase Auth
- UI: CSS + Lucide React

## Structure
```
frontend/   React application
backend/    Express API
database/   PostgreSQL schema and Supabase migrations
```

## Implemented
- Single Supabase-authenticated login/signup flow with role-based access
- Admin dashboard: total users, stores and ratings
- Admin user creation for normal users, store owners and administrators
- Admin user filtering by name, email, address and role
- Admin sorting and user details
- Store creation and store-owner assignment
- Normal-user store search and 1–5 rating submission/modification
- Store-owner dashboard with assigned stores, customer ratings and average rating
- Profile and password updates
- Required name, address, email and password validation
- PostgreSQL constraints, indexes and row-level security

## Local setup

### Database
Create a Supabase project and run `database/schema.sql` in the Supabase SQL Editor. The historical migrations are retained under `database/migrations`.

Create a first account through the frontend, then promote it once:
```sql
update public.profiles
set role = 'admin'
where email = 'your-admin@example.com';
```

### Backend
```bash
cd backend
npm install
```

Create `backend/.env` from `.env.example`:
```env
PORT=4000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
```

Start:
```bash
npm run dev
```

### Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env` from `.env.example`:
```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_API_URL=http://localhost:4000/api
```

Start:
```bash
npm run dev
```

## Security
Never put the Supabase service-role key in the frontend or commit it to GitHub. It belongs only in `backend/.env`. The browser uses the public anon key for authentication and sends its access token to the Express API.