type KnipConfig = {
  next?: {
    entry?: string[];
  };
  entry?: string[];
  project?: string[];
  ignoreDependencies?: string[];
  ignoreIssues?: Record<string, string[]>;
};

const config: KnipConfig = {
  next: {
    entry: [
      'src/proxy.ts',
      'next.config.ts',
      'src/i18n/request.ts',
      'src/i18n/navigation.ts',
      'src/i18n/config.ts',
    ],
  },
  entry: [
    'src/app/**/{page,layout,loading,error,not-found,template,default,route,manifest}.{ts,tsx}',
    'src/app/**/route.ts',
    'scripts/**/*.{js,mjs,ts}',
  ],
  project: ['src/**/*.{ts,tsx}'],
  ignoreDependencies: [
    // Used only via `@import 'tailwindcss'` in src/app/globals.css and the
    // `@tailwindcss/postcss` plugin in postcss.config.mjs — knip can't see
    // CSS-level imports, so it's flagged as unused even though the build
    // depends on it.
    'tailwindcss',
  ],
  ignoreIssues: {
    // `SkipCoachAdjustment` is consumed exclusively via the inline
    // `import('@/lib/skip-coach-loop').SkipCoachAdjustment` type-expression
    // syntax in src/lib/life-coach/api-client.ts and
    // src/lib/life-coach/generate-daily-steps-for-user.ts. Knip's static
    // analysis does not resolve identifiers referenced through that
    // inline-import form, so it is flagged as unused even though it is
    // genuinely required.
    'src/lib/skip-coach-loop/index.ts': ['types'],
  },
};

export default config;
