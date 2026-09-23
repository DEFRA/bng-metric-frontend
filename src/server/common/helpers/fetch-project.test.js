import { describe, expect, test, vi } from 'vitest'

import { fetchProjectOrThrow } from './fetch-project.js'
import { fetchProject } from '../services/projects.js'

vi.mock('../services/projects.js', () => ({ fetchProject: vi.fn() }))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const request = {}

const respondWith = (payload, statusCode = 200) => {
  vi.mocked(fetchProject).mockResolvedValue({ statusCode, payload })
}

describe('fetchProjectOrThrow', () => {
  test('returns the project document', async () => {
    respondWith({ project: { name: 'Riverbank restoration' } })

    expect(await fetchProjectOrThrow(request, PROJECT_ID)).toMatchObject({
      name: 'Riverbank restoration'
    })
  })

  test('merges the derived trading-rule statuses in from the envelope', async () => {
    // The backend derives them per request, so they arrive beside the document
    // rather than inside it. Callers should not have to know that.
    const tradingRuleStatuses = {
      areaHabitats: { medium: 'Not met', low: 'Met', overall: 'Not met' }
    }
    respondWith({ project: { name: 'Riverbank' }, tradingRuleStatuses })

    const project = await fetchProjectOrThrow(request, PROJECT_ID)

    expect(project.tradingRuleStatuses).toEqual(tradingRuleStatuses)
  })

  test('is undefined where the backend sent no statuses', async () => {
    respondWith({ project: { name: 'Riverbank' } })

    const project = await fetchProjectOrThrow(request, PROJECT_ID)

    expect(project.tradingRuleStatuses).toBeUndefined()
  })

  test('returns the falsy payload untouched when there is no project', async () => {
    respondWith({})

    expect(await fetchProjectOrThrow(request, PROJECT_ID)).toBeUndefined()
  })

  test('throws not found for a 404', async () => {
    respondWith({}, 404)

    await expect(fetchProjectOrThrow(request, PROJECT_ID)).rejects.toThrow(
      'Project not found'
    )
  })

  test('throws bad gateway when the backend fails', async () => {
    respondWith({}, 500)

    await expect(fetchProjectOrThrow(request, PROJECT_ID)).rejects.toThrow(
      'Failed to fetch project'
    )
  })

  test('throws bad gateway when there is no response at all', async () => {
    vi.mocked(fetchProject).mockResolvedValue(null)

    await expect(fetchProjectOrThrow(request, PROJECT_ID)).rejects.toThrow(
      'Failed to fetch project'
    )
  })
})
