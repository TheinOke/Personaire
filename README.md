# Personaire

A personal web app for goals, tasks, habits and progress. Built with React, TypeScript and Supabase, hosted on Vercel. It installs on iPhone as a PWA.

## Stack

- React + Vite + TypeScript, Tailwind CSS v4, shadcn-style components (monochrome dark theme)
- React Router, TanStack Query
- Supabase: Postgres, Auth (email + password), Row Level Security, Edge Functions
- vite-plugin-pwa with a custom service worker (`src/sw.ts`) for offline use and push notifications

## First-time setup

### 1. Supabase

1. Create a free account at <https://supabase.com> and a new project named `personaire`.
2. **SQL Editor** → paste the contents of `supabase/migrations/20261121000000_init.sql` → **Run**.
3. **Authentication → Sign In / Providers**:
   - Turn **off** "Allow new users to sign up".
   - Keep Email enabled.
4. **Authentication → Users → Add user → Create new user**: enter your email and a strong password, and tick **Auto Confirm User**.
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
   Never use the `service_role` key in the app.

### 2. Run locally

```powershell
Copy-Item .env.example .env.local   # then paste the URL and anon key into .env.local
npm install
npm run dev
```

Open <http://localhost:5173> and sign in.

### 3. Deploy to Vercel

1. Push this folder to a new GitHub repository.
2. In Vercel: **Add New → Project → import the repository**. It detects Vite automatically.
3. Add the environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Project **Settings → General → Node.js Version**: choose **24.x**.
5. Deploy.

### 4. Install on iPhone

Open the Vercel URL in **Safari** → **Share** → **Add to Home Screen**. Push notifications (built later) work only from this installed app, on iOS 16.4 or newer.

## Push notifications setup (M09)

Reminders are sent by the `send-reminders` Edge Function. A scheduled job in the database calls it every minute.

The push keys and cron secret are already generated into two **git-ignored** files:
`supabase/.env.secrets.local` and `supabase/secrets.local.sql`. Never commit or share them.

1. Edit `supabase/.env.secrets.local` and set `VAPID_SUBJECT` to your Vercel app URL (for example `https://personaire.vercel.app`).
2. Log in and link the CLI to your project. Linking asks for the database password.
   ```powershell
   npx supabase login
   npx supabase link --project-ref YOUR-PROJECT-REF
   ```
3. Upload the function secrets and deploy the function:
   ```powershell
   npx supabase secrets set --env-file supabase/.env.secrets.local
   npx supabase functions deploy send-reminders --no-verify-jwt
   ```
4. In the Supabase **SQL Editor**, run `supabase/secrets.local.sql`, then `supabase/migrations/20261121000200_notifications.sql`.
5. In **Vercel → Settings → Environment Variables**, add `VITE_VAPID_PUBLIC_KEY`. Its value is in `.env.local`. Then redeploy.
6. On the iPhone, open the Home Screen app → **Settings → Notifications → Enable notifications** → **Send test**.

Don't run `supabase config push`: `supabase/config.toml` holds local-development defaults.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build for production (generates PWA icons) |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |

## Project layout

```
src/
  app/          router, layout, navigation
  features/     one folder per feature (dashboard, goals, tasks, planner, habits, ...)
  components/   shared components; ui/ holds the base components
  lib/          supabase client, query client, helpers
  sw.ts         service worker (offline + push)
supabase/
  migrations/   database schema
  functions/    Edge Functions (push reminders, added later)
```

## Roadmap

- [x] Step 1: setup (scaffold, theme, login, layout, PWA, schema)
- [x] Step 2: Categories (M08), Settings (M10)
- [x] Step 3: Goals (M02), Tasks (M03), Task Breakdown (M04)
- [x] Step 4: Daily Planner (M05), Habits (M06)
- [x] Step 5: Progress (M07), Dashboard (M01)
- [x] Step 6: Push notifications (M09)
- [ ] Later: should-have features (fitness, reading, time tracking, Pomodoro, reviews, finance, AI with Gemini)
