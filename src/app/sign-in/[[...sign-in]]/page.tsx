import {SignIn} from '@clerk/nextjs';
import {AuthDisabledFallback} from '@/components/auth/auth-disabled-fallback';
import {isClerkConfigured} from '@/lib/auth/clerk-config';
import {resolveAuthPageLocale} from '@/lib/auth/resolve-auth-page-locale';

export default async function SignInPage() {
  const locale = await resolveAuthPageLocale();

  if (!isClerkConfigured()) {
    return <AuthDisabledFallback locale={locale} variant="sign-in" />;
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignIn
        path={`/${locale}/sign-in`}
        routing="path"
        signUpUrl={`/${locale}/sign-up`}
        fallbackRedirectUrl={`/${locale}`}
        forceRedirectUrl={`/${locale}`}
      />
    </main>
  );
}
