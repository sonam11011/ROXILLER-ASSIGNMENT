# Roxiller Store Rating Platform

A full-stack implementation of the Roxiller FullStack Intern Coding Challenge.

## Architecture

- **Frontend:** React + TypeScript + Vite
- **Backend:** Node.js + Express REST API
- **Database:** PostgreSQL hosted by Supabase
- **Authentication:** Supabase Auth
- **UI:** CSS + Lucide React

The application follows a simple separation of responsibilities:

1. **PostgreSQL schema** defines tables, relationships, constraints, indexes, triggers and row-level security.
2. **Express backend** owns business logic, validation, role authorization and privileged database/Auth operations.
3. **React frontend** handles authentication UI, forms, navigation and presentation.
4. **Supabase** provides the hosted PostgreSQL database and authentication service.

The frontend never receives the Supabase service-role key.

## Roles

### System Administrator
- Dashboard counts for users, stores and ratings
- Create normal users, store owners and administrators
- Search/filter/sort users
- View user details and store-owner rating
- Create stores and assign store owners
- Search/sort stores
- Sign out

### Normal User
- Sign up and sign in
- Browse/search stores
- View overall store rating
- View their submitted rating
- Submit or modify a 1–5 rating
- Update profile and password
- Sign out

### Store Owner
- Sign in
- View assigned stores
- View ratings received and average rating
- View reviewer information
- Update profile and password
- Sign out

## Validation

- Name: 20–60 characters
- Address: 1–400 characters
- Password: 8–16 characters, at least one uppercase letter and one special character
- Email: standard email validation
- Rating: integer from 1 to 5
- One rating per user per store
- A store can only be assigned to a profile whose role is `owner`

Validation exists in the API and is reinforced by PostgreSQL constraints where appropriate.

## Project structure

```
ROXILLER-ASSIGNMENT/
├── frontend/
│   └── src/
│       ├── App.tsx
│       ├── index.css
│       └── lib/supabase.ts
├── backend/
│   └── src/
│       ├── server.js
│       └── seed-test-users.js
├── database/
│   ├── schema.sql
│   └── migrations/
├── .github/
│   └── workflows/verify.yml
└── README.md
```

## Database setup

Create/use a Supabase project and run:

```text
database/schema.sql
```

The schema creates:

- `profiles`
- `stores`
- `ratings`
- Foreign-key relationships
- Unique user/store rating constraint
- Validation constraints
- Search/sort indexes
- Updated-at triggers
- New-user profile trigger
- Store-owner validation trigger
- RLS policies

No fabricated ratings are inserted by the schema.

## Backend setup

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SECRET_KEY
```

Start the API:

```bash
npm run dev
```

Health check:

```text
http://localhost:4000/api/health
```

## Frontend setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
VITE_API_URL=http://localhost:4000/api
```

Start:

```bash
npm run dev
```

## Test accounts

The repository contains a disposable test-account seeder at `backend/src/seed-test-users.js`.

Set these values in `backend/.env` before running it:

```env
TEST_ADMIN_PASSWORD=Admin@123
TEST_OWNER_PASSWORD=Owner@123
TEST_USER1_PASSWORD=UserOne@123
TEST_USER2_PASSWORD=UserTwo@123
TEST_USER3_PASSWORD=UserThree@123
```

Then:

```bash
cd backend
node src/seed-test-users.js
```

The seeder creates accounts in **Supabase Auth** and their corresponding rows in `public.profiles`. It does not create ratings or fabricated store activity.

| Role | Email |
|---|---|
| Admin | admin@test.roxiler.com |
| Store Owner | owner@test.roxiler.com |
| Normal User | user1@test.roxiler.com |
| Normal User | user2@test.roxiler.com |
| Normal User | user3@test.roxiler.com |

These are disposable assessment/test credentials. Change or remove them after evaluation.

## Security

- Never commit `backend/.env`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Frontend uses only the public Supabase key.
- Every protected API route validates the Supabase access token.
- Role authorization is enforced by the backend.
- PostgreSQL RLS is enabled on all public application tables.
- Ratings are restricted to the authenticated user's own rows for writes.
- Store ownership is protected by a database trigger.

## Verification

GitHub Actions verifies:

- Frontend dependency installation
- TypeScript type-check
- Frontend production build
- Backend dependency installation
- Backend JavaScript syntax

Before submission, verify all three roles manually against the challenge requirements.
