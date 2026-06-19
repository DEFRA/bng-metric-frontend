import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const { getController, postController } = await import('./controller.js')

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const featureId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

describe('#postInterventionHabitatDetailsController', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('GET fetches post-intervention feature data and renders shared details page', async () => {
    vi.mocked(wreck.get).mockImplementation((url) => {
      if (url.includes(`/projects/${projectId}/post-intervention/features/`)) {
        return Promise.resolve({
          payload: {
            type: 'habitat',
            feature: {
              featureId,
              ref: 'P-1',
              broadType: 'Grassland',
              type: 'Modified grassland',
              sizeSquareMetres: 25000,
              units: 2.5
            }
          }
        })
      }
      if (url.includes(`/projects/${projectId}`)) {
        return Promise.resolve({
          payload: { project: { name: 'Test Project' } }
        })
      }
      if (url.includes('/reference/habitat-types-by-broad')) {
        return Promise.resolve({
          payload: {
            Grassland: [
              {
                name: 'Modified grassland',
                distinctiveness: 'Low',
                distinctivenessScore: 2
              }
            ]
          }
        })
      }
      if (url.includes('/reference/trading-rules')) {
        return Promise.resolve({ payload: {} })
      }
      if (url.includes('/reference/conditions')) {
        return Promise.resolve({ payload: [] })
      }
      throw new Error(`Unexpected URL ${url}`)
    })

    const h = createMockH()
    await getController.handler({ query: { projectId, featureId } }, h)

    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/features/${featureId}`
      ),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(h.view).toHaveBeenCalledWith(
      'habitat-details/habitat-details',
      expect.objectContaining({
        formAction: '/post-intervention-habitat-details',
        detailsSectionHeading: 'Post-intervention Details',
        backHref: `/projects/${projectId}/post-intervention-habitat-list`,
        cancelHref: `/projects/${projectId}/post-intervention-habitat-list#habitat-${featureId}`
      })
    )
  })

  test('POST saves to post-intervention habitat endpoint', async () => {
    vi.mocked(wreck.put).mockResolvedValue({
      res: { statusCode: 200 }
    })
    const h = createMockH()

    await postController.handler(
      {
        payload: {
          projectId,
          featureId,
          broadHabitat: 'Grassland',
          habitatType: 'Modified grassland',
          condition: 'Good'
        }
      },
      h
    )

    expect(wreck.put).toHaveBeenCalledWith(
      expect.stringContaining(
        `/projects/${projectId}/post-intervention/habitats/${featureId}`
      ),
      expect.any(Object)
    )
    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${projectId}/post-intervention-habitat-list#habitat-${featureId}`
    )
  })
})
