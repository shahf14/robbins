# Data and Production Readiness

> For the current local schema, integrity rules, normalization decisions, and
> recommended migration sequence, see [Database Architecture Audit](./database-architecture-audit.md).

This prototype is local-first. These are the production boundaries required before handling real sensitive user data.

## Database Entities

```sql
users (
  id uuid primary key,
  email text unique,
  preferred_language text check (preferred_language in ('he', 'en')),
  timezone text not null,
  created_at timestamptz not null
);

check_ins (
  id uuid primary key,
  user_id uuid references users(id),
  emotion text not null,
  escape_score int check (escape_score between 1 and 10),
  energy_score int check (energy_score between 1 and 10),
  truth text not null,
  coach_response text not null,
  daily_challenge text not null,
  challenge_done boolean not null default false,
  created_at timestamptz not null
);

coach_follow_ups (
  id uuid primary key,
  check_in_id uuid references check_ins(id),
  question text not null,
  response text not null,
  created_at timestamptz not null
);

notification_preferences (
  user_id uuid primary key references users(id),
  daily_time time,
  push_subscription jsonb,
  enabled boolean not null default false
);
```

## Required Before Production

- Authentication with email/social login.
- Server-side encrypted storage for check-ins and coach responses.
- User-facing export and deletion controls.
- Reviewed Privacy Policy and Terms of Use.
- HTTPS-only deployment.
- Push notification subscription flow and scheduled server jobs.
- OpenAI production configuration through `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Abuse, crisis, and safety handling for emotionally sensitive inputs.
