import { config } from '../../../config/config.js'
import { isGoogleTagManagerEnabled } from './google-tag-manager.js'

describe('non-production Google Tag Manager', () => {
  const originalEnvironment = config.get('environment')
  const originalEnabled = config.get('googleTagManager.enabled')

  afterEach(() => {
    config.set('environment', originalEnvironment)
    config.set('googleTagManager.enabled', originalEnabled)
  })

  test.each(['local', 'dev', 'test', 'ext-test', 'perf-test'])(
    'enables the container in %s',
    (environment) => {
      config.set('environment', environment)
      config.set('googleTagManager.enabled', true)
      expect(isGoogleTagManagerEnabled()).toBe(true)
    }
  )

  test.each(['prod', 'production', '', 'unknown'])(
    'does not enable the container in %j even when GTM_ENABLED is true',
    (environment) => {
      config.set('environment', environment)
      config.set('googleTagManager.enabled', true)
      expect(isGoogleTagManagerEnabled()).toBe(false)
    }
  )

  test('can disable the container in non-prod', () => {
    config.set('environment', 'dev')
    config.set('googleTagManager.enabled', false)
    expect(isGoogleTagManagerEnabled()).toBe(false)
  })
})
