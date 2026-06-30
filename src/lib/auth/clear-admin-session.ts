/** Clears the httpOnly admin session cookie (best-effort). */
export async function clearAdminSession(): Promise<void> {
  if (typeof window === 'undefined') return;
  await fetch('/api/admin/session', {method: 'DELETE', credentials: 'same-origin'}).catch(() => {});
}
