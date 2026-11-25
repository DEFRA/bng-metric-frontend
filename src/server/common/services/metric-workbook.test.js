import { statusCodes } from '../constants.js'
import { fetchMetricWorkbook } from './metric-workbook.js'
import { backendRequest } from '../helpers/auth/backend-request.js'
import { rateLimitedError } from '../helpers/rate-limited.js'

const mockLoggerError = vi.hoisted(() => vi.fn())
const mockLoggerInfo = vi.hoisted(() => vi.fn())

vi.mock('../helpers/auth/backend-request.js', () => ({
  backendRequest: vi.fn()
}))

vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: mockLoggerInfo, error: mockLoggerError })
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const WORKBOOK = Buffer.from('PK pretend workbook')
const request = {}

describe('#fetchMetricWorkbook', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  test('returns the workbook bytes and the status the backend gave', async () => {
    vi.mocked(backendRequest).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: WORKBOOK
    })

    expect(await fetchMetricWorkbook(request, PROJECT_ID, 'xlsm')).toEqual({
      statusCode: statusCodes.ok,
      bytes: WORKBOOK
    })
    expect(backendRequest).toHaveBeenCalledWith(
      request,
      'get',
      expect.stringMatching(
        new RegExp(`/projects/${PROJECT_ID}/metric\\.xlsm$`)
      ),
      { json: false }
    )
  })

  test('reports a backend error response as that status', async () => {
    const error = new Error('Internal Server Error')
    error.data = {
      isResponseError: true,
      res: { statusCode: statusCodes.internalServerError }
    }
    vi.mocked(backendRequest).mockRejectedValue(error)

    expect(await fetchMetricWorkbook(request, PROJECT_ID, 'xlsx')).toEqual({
      statusCode: statusCodes.internalServerError,
      bytes: null
    })
  })

  test('returns null, and logs which file, when the backend cannot be reached', async () => {
    vi.mocked(backendRequest).mockRejectedValue(new Error('ECONNREFUSED'))

    expect(await fetchMetricWorkbook(request, PROJECT_ID, 'xlsx')).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith(
      `Error fetching the metric workbook (xlsx) - projectId: ${PROJECT_ID}, message: ECONNREFUSED`
    )
  })

  test('lets a dead session through, so the user is sent to sign in again', async () => {
    const error = new Error('session expired')
    error.data = { sessionExpired: true }
    vi.mocked(backendRequest).mockRejectedValue(error)

    await expect(
      fetchMetricWorkbook(request, PROJECT_ID, 'xlsm')
    ).rejects.toThrow('session expired')
  })

  test('passes a refusal by a rate limit on, logged as information only', async () => {
    const refused = rateLimitedError({ 'retry-after': '30' })
    vi.mocked(backendRequest).mockRejectedValue(refused)

    await expect(fetchMetricWorkbook(request, PROJECT_ID, 'xlsm')).rejects.toBe(
      refused
    )
    expect(mockLoggerError).not.toHaveBeenCalled()
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      expect.stringContaining('refused the metric workbook (xlsm)')
    )
  })
})
