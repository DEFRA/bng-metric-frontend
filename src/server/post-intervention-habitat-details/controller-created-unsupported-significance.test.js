import { load } from 'cheerio'
import { wreck } from '../common/helpers/wreck-client.js'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { featureId, mockFeature, projectId } from './controller-test-helpers.js'
import { createdAreaFeature } from './created-area-test-fixtures.js'
import { createdHedgerowFeature } from './created-hedgerow-test-fixtures.js'
import { _resetCreatedAreaReferenceCache } from './created-area-edit.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), put: vi.fn() }
}))

describe.each([
  ['habitat', createdAreaFeature],
  ['hedgerow', createdHedgerowFeature]
])('imported Created %s significance', (type, feature) => {
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
  beforeEach(() => {
    _resetCreatedAreaReferenceCache()
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })
  })

  test.each([
    { strategicSignificance: 'Medium' },
    { strategicSignificance: null, rejectedStrategicSignificance: 'Medium' }
  ])(
    'allows rename without clearing the imported significance: %j',
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
      mockFeature({ type, feature: original })
      const url = `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`
      const page = await server.inject({ method: 'GET', url, auth })
      expect(page.statusCode).toBe(200)
      const $ = load(page.payload)
      expect($('#strategicSignificance').val()).toBe('unchanged')
      expect($('#strategicSignificance option:selected').text()).toBe(
        'Medium (imported value)'
      )
      expect($('button[type="submit"]').text()).toContain('Save')
      const form = Object.fromEntries(
        $('input[name],select[name]')
          .toArray()
          .map((el) => [$(el).attr('name'), $(el).val()])
      )
      const { token: crumb, cookie } = await primeCrumb(server)
      const renamed = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...form, ref: 'Renamed', crumb }
      })
      expect(renamed.statusCode).toBe(302)
      expect(JSON.parse(wreck.put.mock.calls[0][1].payload)).not.toHaveProperty(
        'strategicSignificance'
      )
      const cleared = await server.inject({
        method: 'POST',
        url: '/post-intervention-habitat-details',
        auth,
        headers: { cookie },
        payload: { ...form, ref: 'Renamed', strategicSignificance: '', crumb }
      })
      expect(cleared.statusCode).toBe(302)
      expect(
        JSON.parse(wreck.put.mock.calls[1][1].payload).strategicSignificance
      ).toBeNull()
    }
  )

  test('keeps a current supported significance selected despite historical rejection metadata', async () => {
    mockFeature({
      type,
      feature: {
        ...structuredClone(feature),
        proposed: {
          ...feature.proposed,
          strategicSignificance: 'Low',
          strategicSignificanceCategory: 'Low',
          rejectedStrategicSignificance: 'Medium'
        }
      }
    })
    const page = await server.inject({
      method: 'GET',
      url: `/post-intervention-habitat-details?projectId=${projectId}&featureId=${featureId}`,
      auth
    })
    expect(page.statusCode).toBe(200)
    const $ = load(page.payload)
    expect($('#strategicSignificance').val()).toBe('Low')
    expect($('#strategicSignificance-hint').text()).not.toContain('Medium')
  })
})
