import { config } from '../../../config/config.js'

// Allowlist, so an empty, unknown or misspelled ENVIRONMENT counts as prod.
// infra-dev and management are deliberately absent: they are platform
// environments that do not need the non-prod GTM container. ENVIRONMENT is
// injected by the CDP platform, not set in cdp-app-config.
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
