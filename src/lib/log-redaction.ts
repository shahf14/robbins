const SENSITIVE_QUERY_PARAMS = ['token', 'key', 'secret', 'code', 'password', 'auth'];

export function redactSensitiveText(value: string | undefined | null): string | undefined {
  if (!value) return undefined;

  let redacted = value
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9]{8,}\b/g, 'sk-[REDACTED]')
    .replace(/\bwhsec_[A-Za-z0-9]+\b/g, 'whsec_[REDACTED]')
    .replace(/\bpk_(test|live)_[A-Za-z0-9]+\b/g, 'pk_[REDACTED]');

  try {
    const url = new URL(redacted);
    for (const param of SENSITIVE_QUERY_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.set(param, '[REDACTED]');
      }
    }
    redacted = url.toString();
  } catch {
    // Not a URL — keep string redaction only.
  }

  return redacted;
}

export function redactLogFields(input: {
  message?: string;
  stack?: string;
  url?: string;
  userAgent?: string;
}) {
  return {
    message: redactSensitiveText(input.message),
    stack: redactSensitiveText(input.stack),
    url: redactSensitiveText(input.url),
    userAgent: input.userAgent,
  };
}
