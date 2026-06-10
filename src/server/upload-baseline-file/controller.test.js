import { initiateUpload } from '../common/services/uploader.js'
import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/services/uploader.js')

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

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
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Test Project' } }
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
      metadata: { projectId: 'proj-123', uploadType: 'baseline' }
    })
    expect(request.yar.set).toHaveBeenCalledWith('pendingUploadId', 'abc-123')
    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        uploadUrl: '/upload-and-scan/abc-123',
        heading: 'Upload a GeoPackage (.gpkg) file'
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
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'My BNG Project' } }
    })
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        caption: 'My BNG Project'
      })
    )
  })

  it('should fall back to "Project" when backend call fails', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Network error'))
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        caption: 'Project'
      })
    )
  })

  it('should fall back to "Project" when backend returns no project key', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: {}
    })
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        caption: 'Project'
      })
    )
  })

  it('should display flash error and clear it from session', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = {
      ...createMockRequest(),
      yar: {
        set: vi.fn(),
        get: vi.fn((key) =>
          key === 'uploadError' ? 'File must be a GeoPackage' : null
        ),
        clear: vi.fn()
      }
    }

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('uploadError')
    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        error: { text: 'File must be a GeoPackage' }
      })
    )
  })

  it('should pass error as undefined when there is no flash error', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(request.yar.clear).not.toHaveBeenCalledWith('uploadError')
    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        error: undefined
      })
    )
  })

  it('should set Cache-Control: no-store header on the response', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const response = { header: vi.fn().mockReturnThis() }
    const h = {
      view: vi.fn().mockReturnValue(response),
      redirect: vi.fn().mockReturnThis()
    }
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(response.header).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
})
