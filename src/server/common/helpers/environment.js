import { config } from '../../../config/config.js'

// Allowlist, so an empty, unknown or misspelled ENVIRONMENT counts as prod.
const nonProductionEnvironments = new Set([
  'local',
  'dev',
  'test',
  'ext-test',
  'perf-test'
])

export function isNonProductionEnvironment() {
  return nonProductionEnvironments.has(config.get('environment'))
}
