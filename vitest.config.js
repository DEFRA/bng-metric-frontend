import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
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
        'stylelint.config.js',
        'vitest.config.js',
        '.sonarlint',
        'babel.config.cjs',
        // application.js is the module-load entry point — pure wiring of
        // govuk-frontend `createAll` + module inits, with no behaviour to
        // exercise that isn't already covered by the per-module tests.
        'src/client/javascripts/application.js'
      ]
    }
  }
})
