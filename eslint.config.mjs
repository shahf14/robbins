import nextVitals from 'eslint-config-next/core-web-vitals';

const apiRouteErrorContract = {
  files: ['src/app/api/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: '@/lib/api-response',
            importNames: [
              'badRequest',
              'serverError',
              'notFound',
              'payloadTooLarge',
              'tooManyRequests',
            ],
            message: 'Use jsonError() from @/lib/life-coach/server for API error responses.',
          },
        ],
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        selector:
          "CallExpression[callee.object.name='Response'][callee.property.name='json'] ObjectExpression:has(> Property[key.name='error'])",
        message:
          'Use jsonError() from @/lib/life-coach/server instead of Response.json({ error }).',
      },
      {
        selector:
          "CallExpression[callee.object.name='NextResponse'][callee.property.name='json'] ObjectExpression:has(> Property[key.name='error'])",
        message:
          'Use jsonError() from @/lib/life-coach/server instead of NextResponse.json({ error }).',
      },
    ],
  },
};

const config = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'node_modules/**'],
  },
  apiRouteErrorContract,
];

export default config;
