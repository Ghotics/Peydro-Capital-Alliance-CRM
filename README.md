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
- **Side menu** (`src/nav.ts`): add a line there to add a section. "Leads" shows how many **new** leads are waiting
  (all of them for owners, the ones assigned to you for specialists).
- **Campañas** (landing page): one tab per form — **Business Office**, **Giza**, **Formulario rápido** — each with
  its campaigns and their totals (`#/campaigns/business_office`, `#/campaigns/giza`, `#/campaigns/quick`). Each
  campaign has a **QR code** (download PNG / SVG, copy link) that opens the right website form with `?c=<code>`.
  Owners see scans and conversion.
- **Pipeline:** one column per stage; drag a card to change its stage. Closed stages show the last 30 days.
- **Leads:** list with counters per stage, search, filters, **Exportar CSV** (opens in Excel) and **+ Nuevo lead**
  (for phone calls / visits; the person in charge is picked automatically like website leads).
- **Lead page:** contact buttons, origin, stage, person in charge, meeting, value, reason, notes and the **Historial**
  (who changed what, when; "Automático" = website, auto-assignment or Cal.com).
- **Analítica:** leads per week, per department (with time to first response), and per campaign
  (scans → leads → won). Specialists see their own departments only.
- **Equipo** (owners): add people (temporary password or email invitation), change role / departments / active,
  give a new temporary password; partners and buildings.
- **Ayuda:** a short guide for the team (`src/pages/Help.tsx`).

## Current team (one person per department)

| Department | Person in the CRM |
| --- | --- |
| `giza`, `planificacion-financiera` | Irene |
| `tecnologia` | Tecnología |
| `telecomunicaciones` | Suministros |
| `marketing` | Marketing |
| `consulta`, `quick` | nobody: "Sin asignar", handled by WhatsApp (see `WHATSAPP_*` below) |

**Automatic assignment:** a new lead goes to the active person whose departments include the lead's department
(Business Office → the area picked in the form; Giza → `giza`; quick form → `quick`). Several people in one
department → the one with the fewest open leads. Inactive people get nothing. Change departments in **Equipo**.

## Keys and settings (fill these in when you have them)

Everything below is optional: while a key is missing, that feature simply stays off and the rest keeps working.

### Supabase → Edge Functions → Secrets

| Secret | What for | Example |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | Website + CRM addresses allowed to call the functions (comma-separated). Optional: without it, the three addresses in the example are used | `https://www.peydrocapitalalliance.com,https://peydrocapitalalliance.com,https://crm.peydrocapitalalliance.com` |
| `CRM_URL` | CRM address used in email links | `https://crm.peydrocapitalalliance.com/` |
| `RESEND_API_KEY` | Turns emails on (resend.com → API Keys) | `re_…` |
| `EMAIL_FROM` | Sender, on a domain verified in Resend | `PCA <avisos@peydrocapitalalliance.com>` |
| `EMAIL_REPLY_TO` | Where visitors' replies go (optional) | `info@peydrocapitalalliance.com` |
| `SEND_VISITOR_CONFIRMATION` | `false` = don't email the visitor | `true` (default) |
| `NOTIFY_EXTRA_EMAILS` | Optional: extra addresses that also get an email for every new lead (owners already do, automatically) | `info@peydrocapitalalliance.com` |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API **permanent** (system user) token. Full setup: [docs/whatsapp-setup.md](docs/whatsapp-setup.md) | `EAAG…` |
| `WHATSAPP_PHONE_NUMBER_ID` | Id of the WhatsApp Business number that sends | `1234567890` |
| `WHATSAPP_TO` | Number(s) that receive the alerts, comma-separated | `34600000000,34611111111` |
| `WHATSAPP_TEMPLATE` | Approved template name, with 4 values: {{1}} department, {{2}} name, {{3}} phone, {{4}} CRM link | `nuevo_lead` |
| `WHATSAPP_TEMPLATE_LANG` / `WHATSAPP_DEPARTMENTS` | Template language (default `es`) / which departments alert (default `consulta,quick`) | `es` / `consulta,quick` |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → the widget's **secret** key. Add it only **after** the site key is live on the website; from then on forms without a valid check are refused | empty = check off |
| `CAL_WEBHOOK_SECRET` | Same secret as in Cal.com → Settings → Developer → Webhooks | any long random text |

Who gets what once emails are on, for every new lead from the website: the specialist in charge ("assigned to you");
**every active owner** (+ `NOTIFY_EXTRA_EMAILS`), saying who it went to or that nobody has it; the visitor (confirmation,
in the page's language). Reassigning a lead in the CRM emails the new person in charge.
**After turning visitor emails on**, set `confirmationEmails = true` in the website repo (`src/data/forms.ts`).

### Supabase dashboard

- **Authentication → Emails → SMTP:** Resend's SMTP (host `smtp.resend.com`, port 465, user `resend`, password = API key,
  sender on your domain). Needed for "¿Has olvidado la contraseña?" and email invitations.
- **Authentication → URL Configuration:** Site URL + Redirect URLs = the CRM address.
- **Authentication → Sign In / Providers → "Allow new users to sign up": OFF.**
- **Authentication → Passwords → Leaked password protection: ON** (recommended).

### Cal.com (one booking page per specialist)

1. Each specialist's booking link goes in the website repo, `calLink` in `src/data/forms.ts`.
2. In each Cal.com account: Settings → Developer → Webhooks → New: URL
   `https://vocranrdldtamdcoulzi.supabase.co/functions/v1/cal-webhook`, events *Booking created / rescheduled / cancelled*,
   secret = `CAL_WEBHOOK_SECRET`. Bookings then set the lead's meeting date and stage by themselves.

### GitHub → this repo → Settings → Secrets and variables → Actions → Variables

| Variable | When | Value |
| --- | --- | --- |
| `VITE_WEBSITE_URL` | only to override | default is `https://www.peydrocapitalalliance.com` |
| `BASE_PATH` | only to override | detected from the Pages settings |

**Addresses (since 2026-11-17):** website `https://www.peydrocapitalalliance.com`, CRM `https://crm.peydrocapitalalliance.com`.
DNS at Hostinger: `A @` → GitHub's 4 addresses, `CNAME www` and `CNAME crm` → `ghotics.github.io`, plus the Zoho email records.
The deploy reads the address from the Pages settings, so `BASE_PATH` is only needed to force something unusual.

## Database

Changes live in `supabase/migrations/`. Each file is applied once, in order.

- `20261116150000_crm_access.sql` — adds `leads.department`, the `lead_notes` table and all the access rules. Applied.
- `20261116152500_crm_access_tidy.sql` — small speed clean-up of the rules above (same access). Applied.
- `20261116180000_campaign_stats.sql` — totals per campaign (leads, scans) counted in the database. Applied.
- `20261116190000_auto_assign_leads.sql` — automatic assignment (see above). Applied.
- `20261117090000_history_analytics_team.sql` — lead history, analytics numbers, "always one active owner",
  unique building names per partner. Applied after review.

`supabase/demo/remove_demo_data.sql` removes all fake / test data before launch.

## Server functions (`supabase/functions`)

| Function | Called by | Does |
| --- | --- | --- |
| `website-intake` | the website | `/lead` checks + saves a form, then notifies; `/scan` counts a QR arrival |
| `crm-actions` | the CRM (logged in) | `/notify` email on reassignment; owners: `/team/create`, `/team/password`, `/team/emails` |
| `cal-webhook` | Cal.com | updates the lead's meeting and stage |

Shared code is in `_shared/` (emails, WhatsApp, Cal.com, texts). All three run with "Verify JWT" **off**: the website and
Cal.com don't log in, and `crm-actions` checks the CRM login itself.
Deploy after a change: `supabase functions deploy <name> --no-verify-jwt` (or the Supabase dashboard).

## Automatic checks

`.github/workflows/checks.yml` runs on every pull request: the app builds, the function tests
(`supabase/functions/tests/`) pass, and on a fresh Postgres every migration applies and `supabase/tests/access_test.sql`
confirms who can see and change what. Run them yourself:

```bash
node --experimental-strip-types --test 'supabase/functions/tests/*.test.ts'
psql -f supabase/tests/setup.sql && for f in supabase/migrations/*.sql; do psql -f $f; done && psql -f supabase/tests/access_test.sql
```

## Put it online

**Now: GitHub Pages.** `.github/workflows/deploy.yml` builds the app and publishes it on every push to `main`
(Settings → Pages → Source: GitHub Actions, Custom domain `crm.peydrocapitalalliance.com`).
Address: `https://crm.peydrocapitalalliance.com/` (the old github.io address forwards there).
Pages use `#/…` addresses, so no redirect rules are needed on any host. The app asks search engines not to index it.
