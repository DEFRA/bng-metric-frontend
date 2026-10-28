import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  SERVICE_TEMPLATE_NAME,
  isServiceTemplateDocument
} from './service-template.js'

describe('#isServiceTemplateDocument', () => {
  test('is true for a document uploaded in the BNG Service template', () => {
    expect(
      isServiceTemplateDocument({
        template: { name: SERVICE_TEMPLATE_NAME, version: '1.0' }
      })
    ).toBe(true)
  })

  test.each([
    ['a legacy document, which records no template', { habitats: [] }],
    ['another template', { template: { name: 'natural-england' } }],
    ['a template with no name', { template: {} }],
    ['no document', undefined],
    ['a null document', null]
  ])('is false for %s', (_, document) => {
    expect(isServiceTemplateDocument(document)).toBe(false)
  })
})

describe('#isServiceTemplateEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  async function freshHelper() {
    vi.resetModules()
    return import('./service-template.js')
  }

  test('is off by default', async () => {
    vi.stubEnv('SERVICE_TEMPLATE_ENABLED', undefined)
    const { isServiceTemplateEnabled } = await freshHelper()
    expect(isServiceTemplateEnabled()).toBe(false)
  })

  test('follows SERVICE_TEMPLATE_ENABLED, the backend flag’s name', async () => {
    vi.stubEnv('SERVICE_TEMPLATE_ENABLED', 'true')
    const { isServiceTemplateEnabled } = await freshHelper()
    expect(isServiceTemplateEnabled()).toBe(true)
  })
})
