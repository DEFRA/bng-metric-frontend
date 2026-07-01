import { wreck } from '../helpers/wreck-client.js'
import { fetchProject } from './projects.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const mockPayload = { project: { name: 'Test Project' } }

function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('fetchProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns the payload and forwards the bearer token', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockPayload
    })

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toEqual({ statusCode: 200, payload: mockPayload })
    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}`),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-id-token'
        })
      })
    )
  })

  test('returns null payload when backend payload is null', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: null
    })

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toEqual({ statusCode: 200, payload: null })
  })

  test('returns null when the request throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network error'))

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toBeNull()
  })
})
