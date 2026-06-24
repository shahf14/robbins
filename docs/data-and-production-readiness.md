# Data and Production Readiness

> For the current local schema, integrity rules, normalization decisions, and
> recommended migration sequence, see [Database Architecture Audit](./database-architecture-audit.md).

This prototype is local-first. These are the production boundaries required before handling real sensitive user data.

For the current entity definitions and integrity rules, see the live schema in
`src/lib/db/schema.ts` and the [Database Architecture Audit](./database-architecture-audit.md).

## Required Before Production

- Authentication with email/social login.
- Server-side encrypted storage for check-ins and coach responses.
- User-facing export and deletion controls.
- Reviewed Privacy Policy and Terms of Use.
- HTTPS-only deployment.
- Push notification subscription flow and scheduled server jobs.
- OpenAI production configuration through `OPENAI_API_KEY` and `OPENAI_MODEL`.
- Abuse, crisis, and safety handling for emotionally sensitive inputs.
