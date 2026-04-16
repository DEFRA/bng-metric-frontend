import Wreck from '@hapi/wreck'

import { config } from '../../../config/config.js'

vi.mock('@hapi/wreck', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}))

const { initiateUpload, getUploadStatus } = await import('./uploader.js')

describe('initiateUpload', () => {
  it('should call backend and return uploadId and uploadUrl', async () => {
    vi.mocked(Wreck.post).mockResolvedValue({
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

    expect(Wreck.post).toHaveBeenCalledWith(
      expect.stringContaining('/upload/initiate'),
      expect.objectContaining({
        payload: JSON.stringify({
          redirect: '/projects/1/upload-received',
          s3Bucket: 'baseline-files',
          s3Path: 'baseline/',
          metadata: { projectId: '1' }
        }),
        headers: { 'Content-Type': 'application/json' },
        json: true
      })
    )
  })

  it('should prepend CDP_UPLOADER_URL when configured', async () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'cdpUploader.url') return 'http://localhost:7337'
      return config.get(key)
    })

    vi.mocked(Wreck.post).mockResolvedValue({
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

  it('should return error when backend call fails', async () => {
    vi.mocked(Wreck.post).mockRejectedValue(new Error('Connection refused'))

    const result = await initiateUpload({
      redirect: '/projects/1/upload-received',
      s3Bucket: 'baseline-files'
    })

    expect(result).toEqual({ error: 'Unable to initiate upload' })
  })
})

describe('getUploadStatus', () => {
  it('should return uploadStatus from backend', async () => {
    vi.mocked(Wreck.get).mockResolvedValue({
      payload: { uploadStatus: 'ready' }
    })

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({ uploadStatus: 'ready' })
    expect(Wreck.get).toHaveBeenCalledWith(
      expect.stringContaining('/upload/abc-123/status'),
      { json: true }
    )
  })

  it('should return unknown when uploadStatus is missing', async () => {
    vi.mocked(Wreck.get).mockResolvedValue({
      payload: {}
    })

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({ uploadStatus: 'unknown' })
  })

  it('should return error status when backend call fails', async () => {
    vi.mocked(Wreck.get).mockRejectedValue(new Error('Connection refused'))

    const result = await getUploadStatus('abc-123')

    expect(result).toEqual({
      uploadStatus: 'error',
      error: 'Unable to check upload status'
    })
  })
})
