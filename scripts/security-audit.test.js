import { auditBlockers } from './security-audit.mjs'

const ACCEPTED_DATE = new Date('2026-10-05T00:00:00Z')
const BRACES_CAUSE = {
  name: 'braces',
  url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
}

function report(vulnerabilities) {
  return { auditReportVersion: 2, vulnerabilities }
}

function finding(via, severity = 'high') {
  return { via, severity }
}

test('excepts the agreed advisory and packages affected only through it', () => {
  expect(
    auditBlockers(
      report({
        braces: finding([BRACES_CAUSE]),
        chokidar: finding(['braces']),
        nunjucks: finding(['chokidar']),
        micromatch: finding(['braces']),
        stylelint: finding(['micromatch'])
      }),
      ACCEPTED_DATE
    )
  ).toEqual([])
})

test('blocks another advisory on braces and its dependants', () => {
  expect(
    auditBlockers(
      report({
        braces: finding([
          BRACES_CAUSE,
          { name: 'braces', url: 'https://github.com/advisories/another' }
        ]),
        chokidar: finding(['braces'])
      }),
      ACCEPTED_DATE
    )
  ).toEqual(['braces', 'chokidar'])
})

test.each(['high', 'critical'])('blocks unrelated %s findings', (severity) => {
  expect(
    auditBlockers(
      report({ other: finding([{ name: 'other' }], severity) }),
      ACCEPTED_DATE
    )
  ).toEqual(['other'])
})

test('blocks a dependant with both excepted and unrelated dependency findings', () => {
  expect(
    auditBlockers(
      report({
        braces: finding([BRACES_CAUSE]),
        other: finding([{ name: 'other' }]),
        dependant: finding(['braces', 'other'])
      }),
      ACCEPTED_DATE
    )
  ).toEqual(['other', 'dependant'])
})

test('retains the existing high-severity threshold', () => {
  expect(
    auditBlockers(
      report({ other: finding([{ name: 'other' }], 'moderate') }),
      ACCEPTED_DATE
    )
  ).toEqual([])
})

test('blocks the exception from its expiry date', () => {
  expect(
    auditBlockers(
      report({ braces: finding([BRACES_CAUSE]) }),
      new Date('2026-11-04T00:00:00Z')
    )
  ).toEqual(['braces'])
})

test.each([
  { error: { message: 'registry unavailable' } },
  {},
  { auditReportVersion: 2, vulnerabilities: [] }
])('rejects audit errors or malformed reports', (input) => {
  expect(() => auditBlockers(input, ACCEPTED_DATE)).toThrow()
})

test('rejects unknown severities', () => {
  expect(() =>
    auditBlockers(report({ other: finding([], 'unknown') }), ACCEPTED_DATE)
  ).toThrow()
})

test('blocks incomplete or circular dependency findings', () => {
  expect(
    auditBlockers(
      report({
        missing: finding(['absent']),
        empty: finding([]),
        cycle: finding(['cycle'])
      }),
      ACCEPTED_DATE
    )
  ).toEqual(['missing', 'empty', 'cycle'])
})
