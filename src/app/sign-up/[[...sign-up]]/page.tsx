import {SignUp} from '@clerk/nextjs';
import {AuthDisabledFallback} from '@/components/auth/auth-disabled-fallback';
import {isClerkConfigured} from '@/lib/auth/clerk-config';
import {resolveAuthPageLocale} from '@/lib/auth/resolve-auth-page-locale';

export default async function SignUpPage() {
  const locale = await resolveAuthPageLocale();

  if (!isClerkConfigured()) {
    return <AuthDisabledFallback locale={locale} variant="sign-up" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignUp
        path={`/${locale}/sign-up`}
        routing="path"
        signInUrl={`/${locale}/sign-in`}
        fallbackRedirectUrl={`/${locale}`}
        forceRedirectUrl={`/${locale}`}
      />
    </main>
  );
}
