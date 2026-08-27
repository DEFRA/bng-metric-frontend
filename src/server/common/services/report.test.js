import { statusCodes } from '../constants.js'
import { fetchSiteReport } from './report.js'
import { backendRequest } from '../helpers/auth/backend-request.js'

vi.mock('../helpers/auth/backend-request.js', () => ({
  backendRequest: vi.fn()
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PDF = Buffer.from('%PDF-1.5 pretend report')
const request = {}

describe('#fetchSiteReport', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('returns the PDF bytes and the status the backend gave', async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: PDF
    })

    expect(await fetchSiteReport(request, PROJECT_ID)).toEqual({
      statusCode: statusCodes.ok,
      pdf: PDF
    })
  })

  test("turns off wreck-client's JSON parsing default", async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: PDF
    })

    await fetchSiteReport(request, PROJECT_ID)

    expect(backendRequest).toHaveBeenCalledWith(
      request,
      'get',
      expect.stringContaining(`/projects/${PROJECT_ID}/report.pdf`),
      { json: false }
    )
  })

  test('reports a backend error response as that status, not as a failure', async () => {
    const error = new Error('Not Found')
    error.data = {
      isResponseError: true,
      res: { statusCode: statusCodes.notFound }
    }
    vi.mocked(backendRequest).mockRejectedValue(error)

    expect(await fetchSiteReport(request, PROJECT_ID)).toEqual({
      statusCode: statusCodes.notFound,
      pdf: null
    })
  })

  test('returns null when the backend could not be reached at all', async () => {
    vi.mocked(backendRequest).mockRejectedValue(new Error('ECONNREFUSED'))

    expect(await fetchSiteReport(request, PROJECT_ID)).toBeNull()
  })

  test('lets a dead session through, so the user is sent to sign in again', async () => {
    // Reporting this as a generic backend failure would render an error page
    // instead of the /auth/session-expired redirect the user needs.
    const error = new Error('session expired')
    error.data = { sessionExpired: true }
    vi.mocked(backendRequest).mockRejectedValue(error)

    await expect(fetchSiteReport(request, PROJECT_ID)).rejects.toThrow(
      'session expired'
    )
  })
})
