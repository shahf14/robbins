export async function register() {
  try {
    const {assertLocalAuthConfigured} = await import('@/lib/auth/get-current-user');
    assertLocalAuthConfigured();
  } catch (error) {
    console.error('[boot]', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
