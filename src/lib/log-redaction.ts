const SENSITIVE_QUERY_PARAMS = ['token', 'key', 'secret', 'code', 'password', 'auth'];

const SENSITIVE_LEAK_PATTERNS = [
  /Bearer\s+(?!\[REDACTED\])[A-Za-z0-9._\-+/=]{4,}/i,
  /\bsk-[A-Za-z0-9]{8,}\b/,
  /\bwhsec_[A-Za-z0-9]+\b/,
  /\bpk_(test|live)_[A-Za-z0-9]+\b/,
  /\b(xox[baprs]-|ghp_|gho_|github_pat_)[A-Za-z0-9_\-]+\b/i,
];

export function redactSensitiveText(value: string | undefined | null): string | undefined {
  if (!value) return undefined;

  let redacted = value
    .replace(/Bearer\s+[A-Za-z0-9._\-+/=]+/gi, 'Bearer [REDACTED]')
    .replace(/\bsk-[A-Za-z0-9]{8,}\b/g, 'sk-[REDACTED]')
    .replace(/\bwhsec_[A-Za-z0-9]+\b/g, 'whsec_[REDACTED]')
    .replace(/\bpk_(test|live)_[A-Za-z0-9]+\b/g, 'pk_[REDACTED]')
    .replace(/\b(xox[baprs]-|ghp_|gho_|github_pat_)[A-Za-z0-9_\-]+\b/gi, '[REDACTED_TOKEN]');

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
    userAgent: redactSensitiveText(input.userAgent),
  };
}

export function containsSensitiveLeak(text: string): boolean {
  return SENSITIVE_LEAK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Re-redact string fields and reject lines that still look like secrets. */
export function sanitizeLogLine(line: string): string {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return JSON.stringify({type: 'empty-log', message: '[REDACTED]'}) + '\n';
  }

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const sanitized = {
      ...parsed,
      message: redactSensitiveText(typeof parsed.message === 'string' ? parsed.message : undefined),
      stack: redactSensitiveText(typeof parsed.stack === 'string' ? parsed.stack : undefined),
      url: redactSensitiveText(typeof parsed.url === 'string' ? parsed.url : undefined),
      userAgent: redactSensitiveText(typeof parsed.userAgent === 'string' ? parsed.userAgent : undefined),
    };
    const output = JSON.stringify(sanitized) + '\n';
    if (containsSensitiveLeak(output)) {
      return (
        JSON.stringify({
          type: 'redacted-log',
          message: '[REDACTED]',
          timestamp:
            typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
        }) + '\n'
      );
    }
    return output;
  } catch {
    const redacted = redactSensitiveText(trimmed) ?? '[REDACTED]';
    if (containsSensitiveLeak(redacted)) {
      return JSON.stringify({type: 'redacted-log', message: '[REDACTED]'}) + '\n';
    }
    return JSON.stringify({type: 'invalid-log', message: redacted}) + '\n';
  }
}
