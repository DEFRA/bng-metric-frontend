import { config } from '../../../config/config.js'
import { wreck } from '../helpers/wreck-client.js'

const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), error: mockLoggerError })
}))

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const { initiateUpload, getUploadStatus } = await import('./uploader.js')

// backendRequest reads the id_token from the yar session and forwards it as a
// Bearer header, so the upload service calls now take a request as first arg.
function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('initiateUpload', () => {
  it('should call backend and return uploadId and uploadUrl', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        uploadId: 'abc-123',
        uploadUrl: '/upload-and-scan/abc-123'
      }
    })

    const result = await initiateUpload(makeRequest(), {
      redirect: '/projects/1/upload-received',
      s3Bucket: 'baseline-files',
      s3Path: 'baseline/',
      metadata: { projectId: '1' }
    })

    expect(result).toEqual({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining('/upload/initiate'),
      expect.objectContaining({
        payload: JSON.stringify({
          redirect: '/projects/1/upload-received',
          s3Bucket: 'baseline-files',
          s3Path: 'baseline/',
          metadata: { projectId: '1' }
        }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-id-token'
        })
      })
    )
  })

  it('should prepend CDP_UPLOADER_URL when configured', async () => {
    const originalGet = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'cdpUploader.url') {
        return 'http://localhost:7337'
      }
      return originalGet(key)
    })

    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        uploadId: 'abc-123',
        uploadUrl: '/upload-and-scan/abc-123'
      }
    })

    const result = await initiateUpload(makeRequest(), {
      redirect: '/projects/1/upload-received',
      s3Bucket: 'baseline-files'
    })

    expect(result.uploadUrl).toBe(
      'http://localhost:7337/upload-and-scan/abc-123'
    )
  })

  it('should throw Boom badGateway when backend call fails', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('Connection refused'))

    await expect(
      initiateUpload(makeRequest(), {
        redirect: '/projects/1/upload-received',
        s3Bucket: 'baseline-files'
      })
    ).rejects.toThrow('Unable to initiate upload')
  })

  it('should log the backend reason phrase but not its message', async () => {
    const error = new Error('Response Error: 400 Bad Request')
    error.data = {
      isResponseError: true,
      res: { statusCode: 400 },
      payload: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'echoed user input jane@example.com'
      }
    }
    vi.mocked(wreck.post).mockRejectedValue(error)

    await expect(
      initiateUpload(makeRequest(), {
        redirect: '/projects/1/upload-received',
        s3Bucket: 'baseline-files'
      })
    ).rejects.toThrow('Unable to initiate upload')

    const logged = mockLoggerError.mock.calls.at(-1)[0]
    expect(logged).toContain('body: {"error":"Bad Request"}')
    expect(logged).not.toContain('jane@example.com')
  })
})

describe('initiateUpload refused by a rate limit', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // What wreck throws for the backend's 429: its shortcut methods reject on
  // a 4xx with the response attached.
  function tooManyRequests(retryAfter) {
    const error = new Error('Response Error: 429 Too Many Requests')
    error.data = {
      isResponseError: true,
      res: { statusCode: 429, headers: { 'retry-after': retryAfter } },
      payload: { statusCode: 429, error: 'Too Many Requests' }
    }
    return error
  }

  it('passes the refusal on as a 429 with the wait, not a 502', async () => {
    vi.mocked(wreck.post).mockRejectedValue(tooManyRequests('42'))

    await expect(
      initiateUpload(makeRequest(), {
        redirect: '/projects/1/upload-received',
        s3Bucket: 'baseline-files'
      })
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 429 },
      data: { rateLimited: true, retryAfterSeconds: 42 }
    })
  })

  it('does not log the refusal as a backend failure', async () => {
    vi.mocked(wreck.post).mockRejectedValue(tooManyRequests('42'))

    await initiateUpload(makeRequest(), {
      redirect: '/projects/1/upload-received',
      s3Bucket: 'baseline-files'
    }).catch(() => {})

    expect(mockLoggerError).not.toHaveBeenCalled()
  })
})

describe('getUploadStatus', () => {
  it('keeps polling when a rate limit refuses the status check', async () => {
    const error = new Error('Response Error: 429 Too Many Requests')
    error.data = {
      isResponseError: true,
      res: { statusCode: 429, headers: { 'retry-after': '5' } }
    }
    vi.mocked(wreck.get).mockRejectedValue(error)
    mockLoggerError.mockClear()

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    // The same answer as any failed check, so the checking page refreshes
    // and asks again rather than ending on the "too many requests" page —
    // at the backend's pace.
    expect(result).toEqual({
      uploadStatus: 'error',
      error: 'Unable to check upload status',
      retryAfterSeconds: 5
    })
    expect(mockLoggerError).not.toHaveBeenCalled()
  })

  it('holds a rate-limited status check to the polling maximum of 30 seconds', async () => {
    const error = new Error('Response Error: 429 Too Many Requests')
    error.data = {
      isResponseError: true,
      res: { statusCode: 429, headers: { 'retry-after': '60' } }
    }
    vi.mocked(wreck.get).mockRejectedValue(error)

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    expect(result.retryAfterSeconds).toBe(30)
  })

  it('should return uploadStatus from backend', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { uploadStatus: 'ready', numberOfRejectedFiles: 0 }
    })

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    expect(result).toEqual({ uploadStatus: 'ready' })
    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining('/upload/abc-123/status'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-id-token'
        })
      })
    )
  })

  it('should return rejected with errorMessage when files are rejected', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        uploadStatus: 'ready',
        numberOfRejectedFiles: 1,
        errorMessage: 'The selected file contains a virus'
      }
    })

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    expect(result).toEqual({
      uploadStatus: 'rejected',
      errorMessage: 'The selected file contains a virus'
    })
  })

  it('should return unknown when uploadStatus is missing', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    expect(result).toEqual({ uploadStatus: 'unknown' })
  })

  it('should return error status when backend call fails', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const result = await getUploadStatus(makeRequest(), 'abc-123')

    expect(result).toEqual({
      uploadStatus: 'error',
      error: 'Unable to check upload status'
    })
  })

  it('should log the backend reason phrase but not its message', async () => {
    const error = new Error('Response Error: 400 Bad Request')
    error.data = {
      isResponseError: true,
      res: { statusCode: 400 },
      payload: {
        statusCode: 400,
        error: 'Bad Request',
        message: 'echoed user input jane@example.com'
      }
    }
    vi.mocked(wreck.get).mockRejectedValue(error)

    await getUploadStatus(makeRequest(), 'abc-123')

    const logged = mockLoggerError.mock.calls.at(-1)[0]
    expect(logged).toContain('body: {"error":"Bad Request"}')
    expect(logged).not.toContain('jane@example.com')
  })
})
