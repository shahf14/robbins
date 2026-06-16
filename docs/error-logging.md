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
