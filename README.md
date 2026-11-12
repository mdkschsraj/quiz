# College Quiz & Raffle

Next.js 15 + Supabase + Vercel.

> Status: the code has unit tests for phone matching, CSV import, draw selection and the student-list grouping. It has not yet been through a full `npm run build` or a browser test. Run the setup below, try each page, and report anything that breaks.

## What is in here

**Students**
- Coaching-center QR links: `/c/<slug>`
- Registration (name, phone, admission type, optional gender; the coaching center is not shown, it comes from the QR link) with silent phone matching, no OTP
- Timed quiz with random questions, server-enforced deadline and scoring, auto-submit at zero
- Result page designed as a raffle ticket: score, a warm "watch the live draw" message, and a bold "watch the live draw on Facebook" message and a Facebook follow/share button (default page `schs.rajshahi`, override with `NEXT_PUBLIC_FACEBOOK_URL`). The page is also linked on the registration page and after the public draw reveal

**Admin (`/admin`)**
- Overview, Centers (create a center, unique QR as PNG/SVG, scan and participation counts)
- Weeks (when the quiz is open, quiz time, questions per quiz)
- Questions (CSV upload and manual add)
- Students (list with date range, center, gender, status; unique or every Start Quiz click; CSV download)
- Flagged (name conflicts)
- Draws (date range, live draw time, groups with prize photos, run, publish, winners CSV, winner photos with a permission tick, prize-delivered mark)

**Public**
- Registration page: a one-line "last draw / next live draw" teaser above the form and a Previous winners strip below it
- Result page: countdown to the next live draw with the prize photo, then the Facebook button
- `/winners`: every published draw with winner photos, names, centers and a "Prize delivered" badge
- `/draw/<id>`: animated winner reveal, visible only after the admin publishes the draw

Not built yet: reports beyond the student list and winners CSV, rate limiting on registration, final privacy text.

## Setup

1. Create a Supabase project. In the SQL editor run, in order: `supabase/migrations/001_init.sql`, `002_scans.sql`, `003_draws.sql`, `004_gender.sql`, `005_showcase.sql` (also creates the photo storage bucket), `006_admission_type.sql`. For testing only, also run `supabase/seed.sql`.
2. Copy `.env.example` to `.env.local` and fill it in (including `ADMIN_EMAILS`).
3. In Supabase, Authentication, Users, Add user: create your admin login with the same email as `ADMIN_EMAILS`.
4. `npm install`, then `npm run dev`.
5. Open `http://localhost:3000/admin`, sign in, then try `/c/center-a`.
6. `npm test` runs the unit tests.

## Admission type and eligible students

- Registration has a required **Admission type** dropdown: Medical, Nursing, A Unit, Other Unit. It is saved on the student the first time and never overwritten. The Students page can filter by it and the CSV exports include it.
- Admin, Draws, open a draw, **Download eligible students (CSV)**: everyone who finished a quiz inside the draw's dates, one row each with their best score, phone, gender, admission type, center, which groups they qualify for, and whether they won (this draw or an earlier one). Use it for small gifts.

## Trust and engagement

- **Next draw:** give a draft draw a live draw date and time in Admin, Draws. While it is still a draft, students see a countdown to it, with the group prizes and their photos, on the result page. It disappears once you run the draw.
- **Winner photos:** after a draw is run, open it in Admin and upload each winner's photo (JPG, PNG or WebP, up to 4 MB). You must tick "Permission to publish this photo" (a parent or guardian's, for students under 18). Photos only appear publicly after you publish the draw and only where that permission was recorded.
- **Prize delivered:** mark each winner when the prize is handed over; the Winners page then shows a "Prize delivered" badge.
- Photos are stored in the Supabase Storage bucket `campaign-photos`, which is public so the pages can display them. Anyone with a photo's link can view it; do not upload anything you would not publish.

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
