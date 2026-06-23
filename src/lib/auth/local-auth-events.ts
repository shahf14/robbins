export const LOCAL_AUTH_REQUIRED_EVENT = 'robbins-local-auth-required';
export const LOCAL_AUTH_READY_EVENT = 'robbins-local-auth-ready';

export function notifyLocalAuthRequired(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCAL_AUTH_REQUIRED_EVENT));
}

export function notifyLocalAuthReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCAL_AUTH_READY_EVENT));
}

export function subscribeLocalAuthRequired(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(LOCAL_AUTH_REQUIRED_EVENT, listener);
  return () => window.removeEventListener(LOCAL_AUTH_REQUIRED_EVENT, listener);
}

export function subscribeLocalAuthReady(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(LOCAL_AUTH_READY_EVENT, listener);
  return () => window.removeEventListener(LOCAL_AUTH_READY_EVENT, listener);
}
