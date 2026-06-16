# Localization Architecture

Localization is a core architectural boundary for this app. Every user-facing feature must accept the selected locale before rendering UI, validating input, or generating AI coaching.

## Supported Locales

- English: `en`, LTR
- Hebrew: `he`, RTL

Locale routing is handled by `next-intl` with explicit URL prefixes:

- `/en`
- `/he`

The middleware detects browser language on first visit and writes the locale through the `NEXT_LOCALE` cookie. The language switcher also persists `preferred_language` in `localStorage`; authenticated profile storage should use the same key shape:

```json
{
  "preferred_language": "he",
  "timezone": "Asia/Jerusalem"
}
```

## Message Files

Messages live in:

- `messages/en.json`
- `messages/he.json`

Do not hard-code user-facing copy in components. This includes validation, onboarding, auth, dashboards, analytics, progress reports, transformation program content, notifications, and coaching interface text.

## Directionality

The locale layout sets:

- `<html lang="en" dir="ltr">`
- `<html lang="he" dir="rtl">`

Components should use logical CSS properties such as `margin-inline`, `padding-inline`, `inline-size`, `start`, and `end` whenever direction matters. Avoid assuming left and right are universal.

## AI Coaching

AI calls must pass language as structured prompt context:

```json
{
  "language": "he",
  "tone": "tony_coach"
}
```

The coach prompt must generate natively in the selected language. Do not ask the model to translate an English answer into Hebrew.

## Testing Matrix

Before release, every major flow must be checked in:

- Hebrew mobile
- Hebrew desktop
- English mobile
- English desktop
- Mixed Hebrew/English content
- AI response rendering
- RTL forms
- RTL animations and transitions
- RTL charts, sliders, cards, modals, navigation, and progress indicators
