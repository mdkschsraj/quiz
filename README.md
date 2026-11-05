# College Quiz & Raffle

Next.js 15 + Supabase + Vercel.

> Status: the code has unit tests for phone matching, CSV import, draw selection and the student-list grouping. It has not yet been through a full `npm run build` or a browser test. Run the setup below, try each page, and report anything that breaks.

## What is in here

**Students**
- Coaching-center QR links: `/c/<slug>`
- Registration (name, phone, optional gender, center) with silent phone matching, no OTP
- Timed quiz with random questions, server-enforced deadline and scoring, auto-submit at zero
- Result page designed as a raffle ticket: score, a warm "watch the live draw" message, and a Facebook follow/share button (set `NEXT_PUBLIC_FACEBOOK_URL`)

**Admin (`/admin`)**
- Overview, Centers (create a center, unique QR as PNG/SVG, scan and participation counts)
- Weeks (when the quiz is open, quiz time, questions per quiz)
- Questions (CSV upload and manual add)
- Students (list with date range, center, gender, status; unique or every Start Quiz click; CSV download)
- Flagged (name conflicts)
- Draws (date range, groups, run, publish, winners CSV)

**Public**
- `/draw/<id>`: animated winner reveal, visible only after the admin publishes the draw

Not built yet: reports beyond the student list and winners CSV, rate limiting on registration, final privacy text.

## Setup

1. Create a Supabase project. In the SQL editor run, in order: `supabase/migrations/001_init.sql`, `002_scans.sql`, `003_draws.sql`, `004_gender.sql`. For testing only, also run `supabase/seed.sql`.
2. Copy `.env.example` to `.env.local` and fill it in (including `ADMIN_EMAILS`).
3. In Supabase, Authentication, Users, Add user: create your admin login with the same email as `ADMIN_EMAILS`.
4. `npm install`, then `npm run dev`.
5. Open `http://localhost:3000/admin`, sign in, then try `/c/center-a`.
6. `npm test` runs the unit tests.

## How the pieces fit

- **Weeks** only control when the quiz is open and its settings. A student can start a quiz only while an active week is running.
- **Start Quiz click**: the student record and an attempt are created at that moment, so the Students page shows people who never finished (status "Started only").
- **Draws** have their own date range. When a draw runs, every student with a submitted quiz inside that range is in the pool once, with their best score in the range. Each group has a minimum score percentage (100 = all correct), a winner count and a prize.
- Groups are drawn strictest first. With "one student can win in more than one group" set to No, a winner is removed from later groups. With "winners of earlier draws can win again" set to No, previous winners are excluded.
- Winners are chosen on the server with a cryptographically secure shuffle and saved with a snapshot of the eligible pool. The public page only reveals the saved result. A draw can run once; if a run fails it is rolled back.
- Publishing a draw shows each winner's name, a masked phone number, center and score on the public page.

## Rules implemented

| Situation | Behavior |
| --- | --- |
| New phone | Student record + attempt created |
| Known phone | Student record reused, new attempt |
| Unfinished attempt (same week) | Resumed, not duplicated |
| Different name on a known phone | Original name kept, `students.name_conflict` set, typed name kept on the attempt |
| Gender | Optional; set only if empty, never overwritten |
| Retake | Allowed; the best score inside a draw's date range counts |
| Timeout | Server closes the attempt with a 5 second network grace; later answers are rejected |

Phone numbers are Bangladeshi mobiles, normalized to `01XXXXXXXXX`. Phone matching is not identity proof.

The older `entries` table (one entry per student per week) is still filled in but no longer used by draws or the result page.

## Deploying to Vercel

Add the environment variables from `.env.example` in Vercel project settings. `vercel.json` runs a daily safety-net job that closes abandoned attempts. Set `NEXT_PUBLIC_SITE_URL` to the live address before downloading QR codes.

## Security notes

- All database access is server-side with the service-role key; RLS is on with no public policies.
- Correct answers are never sent to the browser.
- Every admin page, action and download re-checks the admin session and email allowlist.
- The attempt ID (a random UUID) is the only credential for a quiz page.
- Exported CSV cells starting with `=`, `+`, `-` or `@` are prefixed so spreadsheets do not run them as formulas.
- No rate limiting yet. Add one (for example on `/api/start`) before a large public launch.
- Gender and phone numbers are personal data, and many participants may be under 18. Finalise the privacy notice and consent approach before launch.
