import { vi } from 'vitest'

import { enqueueValidateBaseline, getValidationJobStatus } from './baseline.js'
import { wreck } from '../helpers/wreck-client.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const projectId = '11111111-2222-3333-4444-555555555555'
const uploadId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const jobId = '99999999-8888-7777-6666-555555555555'

const HTTP_OK = 200
const HTTP_ACCEPTED = 202
const HTTP_SERVICE_UNAVAILABLE = 503
const HTTP_NOT_FOUND = 404

function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('#enqueueValidateBaseline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns pending + jobId when the backend accepts the job (202)', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: HTTP_ACCEPTED },
      payload: { jobId, status: 'processing' }
    })

    const result = await enqueueValidateBaseline(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ pending: true, jobId })
  })

  test('returns the inline result when the backend answers 200 valid', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: HTTP_OK },
      payload: { valid: true }
    })

    const result = await enqueueValidateBaseline(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ valid: true })
  })

  test('returns structured errors when the backend answers 200 invalid', async () => {
    const errors = [{ code: 'NO_HABITAT_AREAS', message: 'No habitat areas' }]
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: HTTP_OK },
      payload: { valid: false, errors }
    })

    const result = await enqueueValidateBaseline(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ valid: false, errors })
  })

  test('signals a fallback when the backend worker is disabled (503)', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: HTTP_SERVICE_UNAVAILABLE },
      payload: {}
    })

    const result = await enqueueValidateBaseline(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ unavailable: true })
  })

  test('signals a fallback on a network error', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('network failure'))

    const result = await enqueueValidateBaseline(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ unavailable: true })
  })
})

describe('#getValidationJobStatus', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('returns the job payload on 200', async () => {
    const payload = {
      status: 'succeeded',
      statusCode: HTTP_OK,
      result: { valid: true }
    }
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: HTTP_OK },
      payload
    })

    const result = await getValidationJobStatus(makeRequest(), jobId)

    expect(result).toEqual(payload)
  })

  test('maps a 404 to a failed status', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: HTTP_NOT_FOUND },
      payload: {}
    })

    const result = await getValidationJobStatus(makeRequest(), jobId)

    expect(result).toEqual({
      status: 'failed',
      error: 'Validation job not found'
    })
  })

  test('treats a transient network error as still pending', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('blip'))

    const result = await getValidationJobStatus(makeRequest(), jobId)

    expect(result).toEqual({ status: 'pending' })
  })
})
