import { config } from '../../../config/config.js'
import { wreck } from '../helpers/wreck-client.js'
import { makeUnexpiredIdToken } from '../test-helpers/fake-id-token.js'

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

// backendRequest reads the id_token from the yar session, confirms it is
// unexpired, and forwards it as signed x-defra-id-* headers, so the upload
// service calls take a request as first arg and need a structurally-valid token.
function makeRequest(idToken = makeUnexpiredIdToken()) {
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
          'x-defra-id-token': expect.any(String),
          'x-defra-id-signature': expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      })
    )
    const [, sentOptions] = vi.mocked(wreck.post).mock.calls[0]
    expect(sentOptions.headers).not.toHaveProperty('Authorization')
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
})

describe('getUploadStatus', () => {
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
          'x-defra-id-token': expect.any(String),
          'x-defra-id-signature': expect.stringMatching(/^[0-9a-f]{64}$/)
        })
      })
    )
    const [, sentOptions] = vi.mocked(wreck.get).mock.calls[0]
    expect(sentOptions.headers).not.toHaveProperty('Authorization')
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
})
