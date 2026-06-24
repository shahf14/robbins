export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;

  try {
    const {assertLocalAuthConfigured} = await import('@/lib/auth/assert-local-auth-configured');
    assertLocalAuthConfigured();
  } catch (error) {
    console.error('[boot]', error instanceof Error ? error.message : error);
    const {exit} = await import('node:process');
    exit(1);
  }
}
