import { vi } from 'vitest'

import { wreck } from '../common/helpers/wreck-client.js'

export const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
export const featureId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
export const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

export const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

export const projectPayload = { payload: { project: { name: 'Test Project' } } }
export const projectWithBaselinePayload = {
  payload: {
    project: {
      name: 'Test Project',
      baseline: { habitats: [{ featureId: baselineFeatureId, ref: 'P-1' }] }
    }
  }
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isProjectUrl(url) {
  return (
    url.includes(`/projects/${projectId}`) &&
    !url.includes('/post-intervention/features/')
  )
}

/**
 * Mock the PI feature endpoint and the project endpoint.
 *
 * @param {object} featurePayload
 * @param {object} [projectResponse]
 */
export function mockFeature(featurePayload, projectResponse = projectPayload) {
  vi.mocked(wreck.get).mockImplementation((url) => {
    if (url.includes(`/post-intervention/features/${featureId}`)) {
      return Promise.resolve({ payload: featurePayload })
    }
    if (isProjectUrl(url)) {
      return Promise.resolve(projectResponse)
    }
    throw new Error(`Unexpected URL ${url}`)
  })
}
