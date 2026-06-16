import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <main className="page-shell grid min-h-[70vh] place-items-center py-10">
      <section className="panel-surface max-w-xl p-6 sm:p-8">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl font-black">Page not found</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">This route does not exist yet.</p>
        <Link href="/he" className="focus-ring btn-primary mt-5 inline-flex">
          Go home
        </Link>
      </section>
    </main>
  );
}
