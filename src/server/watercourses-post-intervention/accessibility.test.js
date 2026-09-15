// @vitest-environment happy-dom
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const feature = {
  featureId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  ref: 'W-1',
  units: 0.5,
  sizeMetres: 1000,
  proposed: {
    type: 'Ditches',
    distinctiveness: 'Medium',
    distinctivenessScore: 4,
    condition: 'Good',
    conditionScore: 3,
    watercourseEncroachment: 'Minor',
    waterEncroachmentMultiplier: 0.8,
    riparianEncroachment: 'Minor/Minor',
    riparianEncroachmentMultiplier: 0.8
  }
}

describe('Watercourses post-intervention page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => server.stop({ timeout: 0 }))
  afterEach(() => vi.mocked(wreck.get).mockReset())

  it('has no accessibility issues with all data-grid tabs visible', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'River restoration',
          baseline: {
            watercourses: [{}],
            units: { watercoursesTotal: 1 }
          },
          postIntervention: {
            watercourses: [
              { ...feature, retentionCategory: 'Retained' },
              { ...feature, retentionCategory: 'Enhanced' },
              { ...feature, retentionCategory: 'Created' }
            ],
            units: { watercoursesTotal: 1.5 }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: `/projects/${PROJECT_ID}/watercourses-post-intervention`,
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('has no accessibility issues when only one data-grid tab is visible', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        project: {
          name: 'Created only',
          baseline: {
            watercourses: [{}],
            units: { watercoursesTotal: 0 }
          },
          postIntervention: {
            watercourses: [{ ...feature, retentionCategory: 'Created' }],
            units: { watercoursesTotal: 1 }
          }
        }
      }
    })

    const { document } = await loadPage({
      requestUrl: '/projects/' + PROJECT_ID + '/watercourses-post-intervention',
      server,
      auth
    })

    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
