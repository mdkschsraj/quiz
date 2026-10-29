# College Quiz & Raffle (V1: student flow)

Next.js 15 + Supabase + Vercel.

## What is in this milestone

- Coaching-center QR links: `/c/<slug>`
- Registration (name, phone, center) with silent phone matching, no OTP
- Timed quiz with random questions, server-enforced deadline and scoring
- Auto-submit at zero, manual submit any time
- Weekly entry tracking: one eligible entry per student per week (database unique constraint)
- Result page with score and participation confirmation

Not built yet: admin panel, CSV question upload, draw configuration, secure winner selection, public animated draw page, reports.

## Setup

1. Create a Supabase project. In the SQL editor run `supabase/migrations/001_init.sql`, then (for testing only) `supabase/seed.sql`.
2. Copy `.env.example` to `.env.local` and fill it in.
3. `npm install`
4. `npm run dev`, then open `http://localhost:3000/c/center-a`
5. `npm test` runs the phone-normalization tests.
6. QR codes: `node --env-file=.env.local scripts/generate-qr.mjs` writes `qr-codes/<slug>.png`.

## Deploying to Vercel

Add the four environment variables from `.env.example` in Vercel project settings. `vercel.json` runs a daily safety-net job that closes abandoned attempts.

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
