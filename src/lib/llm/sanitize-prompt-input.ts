/** Strip control chars and cap length for untrusted user text embedded in LLM prompts. */
export function sanitizePromptUserText(value: string, maxLength = 2000): string {
  return value
    .replace(/\u0000/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
