import { config } from '../../../config/config.js'
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

const { initiateUpload, getUploadStatus } = await import('./uploader.js')

describe('initiateUpload', () => {
  it('should call backend and return uploadId and uploadUrl', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {
        uploadId: 'abc-123',
        uploadUrl: '/upload-and-scan/abc-123'
      }
    })

    const result = await initiateUpload({
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
        headers: { 'Content-Type': 'application/json' }
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

    const result = await initiateUpload({
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
      initiateUpload({
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

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({ uploadStatus: 'ready' })
    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining('/upload/abc-123/status')
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

    const result = await getUploadStatus('abc-123')

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

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({ uploadStatus: 'unknown' })
  })

  it('should return error status when backend call fails', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({
      uploadStatus: 'error',
      error: 'Unable to check upload status'
    })
  })
})
