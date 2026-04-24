import { initiateUpload } from '../common/services/uploader.js'

vi.mock('../common/services/uploader.js')

global.fetch = vi.fn()

const { getController } = await import('./controller.js')

const createMockH = () => {
  const response = { header: vi.fn().mockReturnThis() }
  return {
    view: vi.fn().mockReturnValue(response),
    redirect: vi.fn().mockReturnThis()
  }
}

const createMockRequest = (projectId = 'proj-123') => ({
  params: { id: projectId },
  yar: {
    set: vi.fn(),
    get: vi.fn(),
    clear: vi.fn()
  }
})

describe('upload-baseline-file controller', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ project: { name: 'Test Project' } })
    })
  })

  it('should render form with uploadUrl on successful initiation', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(initiateUpload).toHaveBeenCalledWith({
      redirect: '/projects/proj-123/upload-received',
      s3Bucket: 'baseline-files',
      s3Path: 'baseline/',
      metadata: { projectId: 'proj-123' }
    })
    expect(request.yar.set).toHaveBeenCalledWith('pendingUploadId', 'abc-123')
    expect(h.view).toHaveBeenCalledWith(
      'upload-baseline-file/upload-baseline-file',
      expect.objectContaining({
        uploadUrl: '/upload-and-scan/abc-123',
        heading: 'Upload a GeoPackage file'
      })
    )
  })

  it('should throw when initiation fails', async () => {
    vi.mocked(initiateUpload).mockRejectedValue(
      new Error('Unable to initiate upload')
    )

    const h = createMockH()
    const request = createMockRequest()

    await expect(getController.handler(request, h)).rejects.toThrow(
      'Unable to initiate upload'
    )
  })

  it('should use project name from backend', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: () => Promise.resolve({ project: { name: 'My BNG Project' } })
    })
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload-baseline-file/upload-baseline-file',
      expect.objectContaining({
        caption: 'My BNG Project'
      })
    )
  })

  it('should fall back to "Project" when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload-baseline-file/upload-baseline-file',
      expect.objectContaining({
        caption: 'Project'
      })
    )
  })
})
