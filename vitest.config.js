import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // Tests expect the Private Beta allowlist to be off; a developer's own
    // PRIVATE_BETA_ALLOWED_EMAILS must not leak in and deny the test users.
    env: { PRIVATE_BETA_ALLOWED_EMAILS: '' },
    maxWorkers: 4,
    exclude: [...configDefaults.exclude, '.cache/**'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        ...configDefaults.exclude,
        '.public',
        'coverage',
        'postcss.config.js',
        'vitest.config.js',
        '.sonarlint',
        'babel.config.cjs',
        // application.js is the module-load entry point — pure wiring of
        // govuk-frontend `createAll` + module inits, with no behaviour to
        // exercise that isn't already covered by the per-module tests.
        'src/client/javascripts/application.js',
        // A copy-paste template, not real code — never imported or run.
        'src/server/test-helpers/accessibility-test.template.js'
      ]
    }
  }
})
