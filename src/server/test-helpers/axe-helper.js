import { configureAxe } from 'vitest-axe'
import * as matchers from 'vitest-axe/matchers'

expect.extend(matchers)

export const configuredAxe = configureAxe({
  globalOptions: {
    checks: [{ id: 'wcag22a' }, { id: 'wcag22aa' }]
  }
})

/**
 * Run axe-core against a rendered page and assert there are no violations.
 * @param {Element} container root element to check, e.g. document.documentElement
 * @param {object} [options] passed straight through to axe-core
 */
export async function runAxeChecks(container, options = {}) {
  const results = await configuredAxe(container, options)
  expect(results).toHaveNoViolations()
}
