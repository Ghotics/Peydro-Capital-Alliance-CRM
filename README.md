# PCA · CRM

The internal CRM for Peydró Capital Alliance. It is a separate app from the public website
and is not linked from it. Spanish only.

- **Stack:** React + Vite + TypeScript, talking straight to the PCA Supabase project.
- **Who sees what** is decided by rules inside the database (Row Level Security), not by the app.
  Even someone who finds the address can't read anything without an active account.

| Person | Sees | Can change |
| --- | --- | --- |
| Owner (`role = 'owner'`) | every lead | everything, deletes leads, manages the team |
| Specialist | leads of their department(s) + leads assigned to them | those leads and their notes |
| Invited, but not added to `team_members` yet (or `active = false`) | nothing | nothing |

Only owners and specialists can log in. Anyone else who opens the address only sees the login screen.
Leads from the website forms don't go through the CRM: the website saves them with a server function.

A specialist's departments are the `areas` column of `team_members`
(`giza`, `planificacion-financiera`, `tecnologia`, `telecomunicaciones`, `marketing`, `consulta`, `quick`).

## Run it on your computer

Needs Node 20.19 or newer.

```bash
npm install
cp .env.example .env
npm run dev          # opens on http://localhost:5174
```

`npm run build` makes the `dist/` folder to put online.

## What's in it

- Login with email + password, "forgot password", and a "create your password" screen for invites.
- **Side menu** (`src/nav.ts`): add a line there to add a section.
- **Campañas** (landing page): every campaign with its results. Each one has a **QR code** (download PNG / SVG,
  copy link) that opens the right website form with `?c=<code>`. Owners create, edit, switch off and delete
  (only without leads) campaigns. The website address the QR codes use is `VITE_WEBSITE_URL`.
- **Leads:** list with counters per stage, search, and filters by department, campaign and person.
- **Lead page:** contact buttons (email, call, WhatsApp), where it came from (form, campaign, building, utm),
  stage, person in charge, meeting date, value, reason when lost, and notes.

Later: managing buildings and the team from the app, emails, Cal.com bookings.

## Database

Changes live in `supabase/migrations/`. Each file is applied once, in order.

- `20261116150000_crm_access.sql` — adds `leads.department`, the `lead_notes` table and all the access rules. Applied.
- `20261116152500_crm_access_tidy.sql` — small speed clean-up of the rules above (same access). Applied.
- `20261116180000_campaign_stats.sql` — totals per campaign (leads, scans) counted in the database. Applied.

## Website → database (`supabase/functions/website-intake`)

The public website never writes to the tables itself. It calls this Supabase function, which runs with the server key:

- `POST …/functions/v1/website-intake/lead` — checks the form data again (`validate.ts`, same rules as the database),
  links the campaign (`?c=` code) and the building, ignores the same email + form sent twice within 5 minutes,
  saves the lead and returns `{ leadId }`. Unknown codes / buildings are kept in the lead's utm so nothing is lost.
- `POST …/functions/v1/website-intake/scan` — counts one arrival with a campaign code (only the code is sent).
- Only answers the website's address. **When the website gets its own domain:** Supabase → Edge Functions →
  Secrets → `ALLOWED_ORIGINS` = `https://ghotics.github.io,https://www.<domain>` (comma-separated).
- Deploy after a change: Supabase dashboard (Edge Functions → website-intake) or `supabase functions deploy website-intake --no-verify-jwt`.

## Add someone to the team

1. Supabase → **Authentication → Users → Invite user** → their email.
   They get an email, click it, land on the CRM and choose a password.
2. Supabase → **Table editor → team_members → Insert row**:
   - `id`: the user's id (copy it from Authentication → Users)
   - `name`, `role` (`owner` or `specialist`), `areas` (e.g. `{tecnologia}`)

To remove someone, set `active` to `false` (keeps their notes and history).

## Supabase settings to check (once)

- **Authentication → Sign In / Providers → "Allow new users to sign up": OFF.** Only invited people get in.
- **Authentication → URL Configuration:**
  - **Site URL:** the CRM address (now `https://ghotics.github.io/Peydro-Capital-Alliance-CRM/`).
    Invites sent from the dashboard take people there.
  - **Redirect URLs:** the same address. (Only add `http://localhost:5174` if you ever run the CRM on your computer.)

## Put it online

**Now: GitHub Pages.** `.github/workflows/deploy.yml` builds the app and publishes it on every push to `main`.
Needed once: repo **Settings → Pages → Source: GitHub Actions**.
Address: `https://ghotics.github.io/Peydro-Capital-Alliance-CRM/`

**Later: own subdomain** (e.g. `crm.<pca-domain>`): in the workflow set `BASE_PATH: /`, add the domain in
Settings → Pages → Custom domain, and update the Supabase URLs above.

Pages use `#/…` addresses, so no redirect rules are needed on any host. The app asks search engines not to index it.
