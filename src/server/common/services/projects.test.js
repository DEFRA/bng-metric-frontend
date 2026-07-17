import { wreck } from '../helpers/wreck-client.js'
import { fetchProject, patchProjectDetails } from './projects.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), patch: vi.fn() }
}))

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const mockPayload = { project: { name: 'Test Project' } }

function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

// Mirrors the shape @hapi/wreck's get/post/patch/... shortcuts actually
// throw for a non-2xx response (see `_shortcut` in @hapi/wreck/lib/index.js)
// — a real backend error response, as opposed to a network-level failure.
function responseError(statusCode, payload) {
  const error = new Error(`Response Error: ${statusCode}`)
  error.data = { isResponseError: true, res: { statusCode }, payload }
  return error
}

// Mirrors sessionExpiredError() in backend-request.js: thrown when a 401
// couldn't be refreshed, so the session is dead.
function sessionExpiredError() {
  const error = new Error('Backend rejected the bearer token')
  error.data = { sessionExpired: true }
  return error
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

  test('returns the response status and payload when the backend responds with a 404', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      responseError(404, { statusCode: 404, error: 'Not Found' })
    )

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toEqual({
      statusCode: 404,
      payload: { statusCode: 404, error: 'Not Found' }
    })
  })

  test('returns null when the request fails with a network error', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('network error'))

    const result = await fetchProject(makeRequest(), projectId)

    expect(result).toBeNull()
  })

  test('re-throws a session-expired error instead of swallowing it', async () => {
    vi.mocked(wreck.get).mockRejectedValue(sessionExpiredError())

    await expect(fetchProject(makeRequest(), projectId)).rejects.toMatchObject({
      data: { sessionExpired: true }
    })
  })
})

describe('patchProjectDetails', () => {
  const details = { localPlanningAuthority: 'Anytown Borough Council' }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('PATCHes the details endpoint and forwards the bearer token', async () => {
    vi.mocked(wreck.patch).mockResolvedValue({
      res: { statusCode: 200 },
      payload: details
    })

    const result = await patchProjectDetails(makeRequest(), projectId, details)

    expect(result).toEqual({ statusCode: 200, payload: details })
    expect(wreck.patch).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${projectId}/details`),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-id-token',
          'Content-Type': 'application/json'
        }),
        payload: JSON.stringify(details)
      })
    )
  })

  test('returns null payload when backend payload is null', async () => {
    vi.mocked(wreck.patch).mockResolvedValue({
      res: { statusCode: 200 },
      payload: null
    })

    const result = await patchProjectDetails(makeRequest(), projectId, details)

    expect(result).toEqual({ statusCode: 200, payload: null })
  })

  test('returns the response status and payload when the backend responds with a 404', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(
      responseError(404, { statusCode: 404, error: 'Not Found' })
    )

    const result = await patchProjectDetails(makeRequest(), projectId, details)

    expect(result).toEqual({
      statusCode: 404,
      payload: { statusCode: 404, error: 'Not Found' }
    })
  })

  test('returns null when the request fails with a network error', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(new Error('network error'))

    const result = await patchProjectDetails(makeRequest(), projectId, details)

    expect(result).toBeNull()
  })

  test('re-throws a session-expired error instead of swallowing it', async () => {
    vi.mocked(wreck.patch).mockRejectedValue(sessionExpiredError())

    await expect(
      patchProjectDetails(makeRequest(), projectId, details)
    ).rejects.toMatchObject({ data: { sessionExpired: true } })
  })
})
