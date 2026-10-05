import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const BRACES_ADVISORY = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'
const EXCEPTION_EXPIRES = '2026-11-04T00:00:00Z'

// Temporary acceptance agreed on 2026-10-05: no patched braces release exists.
// Used by development watchers and repository glob tooling; Nunjucks template
// watching is disabled in production. Remove when an upstream fix is available.
// Expiry restores the blocking finding automatically; see README Security.
export function auditBlockers(report, now = new Date()) {
  if (
    report?.error ||
    report?.auditReportVersion !== 2 ||
    !report.vulnerabilities ||
    typeof report.vulnerabilities !== 'object' ||
    Array.isArray(report.vulnerabilities)
  ) {
    throw new Error('npm audit did not return a valid vulnerability report')
  }

  const exceptionActive = now.getTime() < Date.parse(EXCEPTION_EXPIRES)

  function onlyExcepted(name, ancestors = new Set()) {
    const vulnerability = report.vulnerabilities[name]
    if (
      ancestors.has(name) ||
      !Array.isArray(vulnerability?.via) ||
      vulnerability.via.length === 0
    ) {
      return false
    }

    const visited = new Set([...ancestors, name])
    return vulnerability.via.every((cause) => {
      if (typeof cause === 'string') {
        return onlyExcepted(cause, visited)
      }
      return (
        exceptionActive &&
        cause?.name === 'braces' &&
        cause?.url === BRACES_ADVISORY
      )
    })
  }

  return Object.entries(report.vulnerabilities)
    .filter(([, vulnerability]) => {
      if (
        !['info', 'low', 'moderate', 'high', 'critical'].includes(
          vulnerability?.severity
        )
      ) {
        throw new Error('npm audit returned an unknown vulnerability severity')
      }
      return ['high', 'critical'].includes(vulnerability.severity)
    })
    .filter(([name]) => !onlyExcepted(name))
    .map(([name]) => name)
}

function main() {
  if (!process.env.npm_execpath) {
    throw new Error('Run this script with npm run security-audit')
  }
  const result = spawnSync(
    process.execPath,
    [process.env.npm_execpath, 'audit', '--json'],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  )
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }
  if (result.error || ![0, 1].includes(result.status)) {
    throw result.error ?? new Error('npm audit failed to run')
  }

  const report = JSON.parse(result.stdout)
  const blockers = auditBlockers(report)
  console.log(
    `Temporary braces exception: ${BRACES_ADVISORY} (expires ${EXCEPTION_EXPIRES}).`
  )
  if (blockers.length > 0) {
    console.error('Blocking audit findings:')
    for (const name of blockers) {
      console.error(name, JSON.stringify(report.vulnerabilities[name], null, 2))
    }
    process.exitCode = 1
  } else {
    console.log('No high or critical findings outside the temporary exception.')
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
