# College Quiz & Raffle (V1: student flow)

Next.js 15 + Supabase + Vercel.

## What is in this milestone

- Coaching-center QR links: `/c/<slug>`
- Registration (name, phone, center) with silent phone matching, no OTP
- Timed quiz with random questions, server-enforced deadline and scoring
- Auto-submit at zero, manual submit any time
- Weekly entry tracking: one eligible entry per student per week (database unique constraint)
- Result page with score and participation confirmation

Not built yet: draw configuration, secure winner selection, public animated draw page, reports.

## Admin panel (`/admin`)

- Pages: overview, centers (create a center, see and download its unique QR as PNG/SVG, scan and participation counts), campaign weeks, question bank (CSV upload + manual add), name conflicts.
- Sign in with a Supabase Auth user whose email is listed in `ADMIN_EMAILS`. Create the user yourself in the Supabase dashboard (Authentication, Users, Add user) and set the password there. No credentials exist in the code.
- Every admin page and every admin action re-checks the session and the allowlist on the server.
- The session cookie lasts at most one hour; sign in again after that.
- CSV columns: `question, option_a, option_b, option_c, option_d, correct` (A to D or 1 to 4). Import is all-or-nothing: if any row is invalid, nothing is imported and the first problems are shown. Template: `public/question-template.csv`.
- Questions are switched off, never deleted, because past attempts refer to them.
- Week times are entered in Bangladesh time (UTC+6).

## Setup

1. Create a Supabase project. In the SQL editor run `supabase/migrations/001_init.sql`, then `002_scans.sql`, then (for testing only) `supabase/seed.sql`.
2. Copy `.env.example` to `.env.local` and fill it in (including `ADMIN_EMAILS`), and create the admin user in Supabase Authentication.
3. `npm install`
4. `npm run dev`, then open `http://localhost:3000/c/center-a`
5. `npm test` runs the phone and CSV tests.
6. QR codes are created and downloaded in Admin, Centers. `scripts/generate-qr.mjs` is an optional bulk alternative.

## QR scan tracking

The center page reports a scan once it loads in a real browser. Admin, Centers shows per center: scans, estimated unique scanners (anonymous cookie), students who started and students who finished the quiz. A scan is a page load, not a person, so treat the numbers as estimates.

## Deploying to Vercel

Add the five environment variables from `.env.example` in Vercel project settings. `vercel.json` runs a daily safety-net job that closes abandoned attempts.

## Rules implemented

| Situation | Behavior |
| --- | --- |
| New phone | Student record + attempt created |
| Known phone | Student record reused, new attempt |
| Unfinished attempt this week | Resumed, not duplicated |
| Different name on a known phone | Original name kept, `students.name_conflict` set, typed name kept on the attempt |
| Second completed attempt in a week | Allowed, but only the first completed attempt creates the entry |
| Timeout | Server closes the attempt with a 5 second network grace; answers saved after that are rejected |

Phone numbers are Bangladeshi mobiles, normalized to `01XXXXXXXXX`. Phone matching is not identity proof.

## Security notes

- All database access is server-side with the service-role key; RLS is on with no public policies.
- Correct answers are never sent to the browser.
- The attempt ID (a random UUID) is the only credential for a quiz page. Anyone with the link can view that result.
- No rate limiting yet. Add one (for example on `/api/start`) before a large public launch.
