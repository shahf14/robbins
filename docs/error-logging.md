# Error Logging

Client-side runtime errors are captured by a small bootstrap script in the root layout and posted to:

```txt
POST /api/log
```

The API writes one JSON-line log file per day:

```txt
logs/YYYY-MM-DD.log
```

Each line includes:

- `timestamp`
- `type`
- `message`
- `stack`
- `source`
- `line`
- `column`
- `url`
- `userAgent`

The date is calculated in the `Asia/Jerusalem` timezone. The `logs/` directory is ignored by git.

Admins can read logs for a date via:

```txt
GET /api/logs?date=YYYY-MM-DD&limit=200
```

Requires the same tokens as other admin DB routes (`LOCAL_AUTH_TOKEN`, `ADMIN_API_TOKEN`, and `ADMIN_EMAIL` in production).
