import { wreck } from '../helpers/wreck-client.js'
import { makeUnexpiredIdToken } from '../test-helpers/fake-id-token.js'
import { fetchProject } from './projects.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn() }
}))

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const mockPayload = { project: { name: 'Test Project' } }

function makeRequest(idToken = makeUnexpiredIdToken()) {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('fetchProject', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns the payload and forwards the signed Defra ID headers', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockPayload
    })

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toEqual(mockPayload)
    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}`),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-defra-id-token': expect.any(String),
          'x-defra-id-signature': expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      })
    )
    const [, sentOptions] = vi.mocked(wreck.get).mock.calls[0]
    expect(sentOptions.headers).not.toHaveProperty('Authorization')
  })

  test('returns null when payload is null', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: null
    })

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toBeNull()
  })

  test('returns null when the request throws', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network error'))

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toBeNull()
  })
})
