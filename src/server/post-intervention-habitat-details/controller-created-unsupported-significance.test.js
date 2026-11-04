import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { featureId, mockFeature, projectId } from './controller-test-helpers.js'
import { createdAreaFeature } from './created-area-test-fixtures.js'
import { createdHedgerowFeature } from './created-hedgerow-test-fixtures.js'
import {
  createdAreaValues,
  _resetCreatedAreaReferenceCache
} from './created-area-edit.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

describe.each([
  ['habitat', createdAreaFeature],
  ['hedgerow', createdHedgerowFeature]
])('unsupported Created %s significance', (type, feature) => {
  let server
  const auth = {
    strategy: 'session',
    credentials: {
      sub: 'test-user',
      email: 'test@example.com',
      roles: ['aaa-bbb:bng completer:3']
    }
  }
  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })
  afterAll(async () => server.stop({ timeout: 0 }))
  beforeEach(() => _resetCreatedAreaReferenceCache())

  test.each([
    { strategicSignificance: 'Medium' },
    { strategicSignificance: null, rejectedStrategicSignificance: 'Medium' }
  ])(
    'refuses a rename and preserves significance on reload: %j',
    async (stored) => {
      const original = {
        ...structuredClone(feature),
        proposed: {
          ...feature.proposed,
          strategicSignificanceCategory: null,
          strategicSignificanceScore: null,
          ...stored
        }
      }
      const snapshot = structuredClone(original)
      mockFeature({ type, feature: original })
      const url = `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
      const page = await server.inject({ method: 'GET', url, auth })
      expect(page.statusCode).toBe(200)
      expect(page.payload).toContain(
        'imported strategic significance is not supported'
      )
      expect(page.payload).toContain('Medium')
      expect(page.payload).not.toContain('name="ref"')
      expect(page.payload).not.toContain('id="strategicSignificance"')
      const { token: crumb, cookie } = await primeCrumb(server)
      const values = createdAreaValues(original)
      if (type === 'hedgerow') {
        delete values.broadHabitat
      }
      const refused = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: {
          projectId,
          featureId,
          ...values,
          ref: 'Renamed',
          strategicSignificance: '',
          crumb
        }
      })
      expect(refused.statusCode).toBe(400)
      expect(wreck.put).not.toHaveBeenCalled()
      const reloaded = await server.inject({ method: 'GET', url, auth })
      expect(reloaded.statusCode).toBe(200)
      expect(reloaded.payload).toContain(original.ref)
      expect(reloaded.payload).toContain('Medium')
      expect(original).toEqual(snapshot)
    }
  )
})
