import { initiateUpload } from '../common/services/uploader.js'
import { backendClient } from '../common/services/backend-client.js'

vi.mock('../common/services/uploader.js')
vi.mock('../common/services/backend-client.js')

const { getController } = await import('./controller.js')

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

const createMockRequest = (projectId = 'proj-123') => ({
  params: { id: projectId },
  auth: { credentials: { sub: 'user-1' } },
  yar: {
    id: 'yar-1',
    set: vi.fn(),
    get: vi.fn(),
    clear: vi.fn()
  }
})

function mockBackendGet(payload) {
  vi.mocked(backendClient).mockReturnValue({
    get: vi.fn().mockResolvedValue({ payload }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  })
}

describe('upload-baseline-file controller', () => {
  beforeEach(() => {
    mockBackendGet({ project: { name: 'Test Project' } })
  })

  it('should render form with uploadUrl on successful initiation', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(initiateUpload).toHaveBeenCalledWith(request, {
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
    mockBackendGet({ project: { name: 'My BNG Project' } })
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

  it('should fall back to "Project" when backend call fails', async () => {
    vi.mocked(backendClient).mockReturnValue({
      get: vi.fn().mockRejectedValue(new Error('Network error')),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn()
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
        caption: 'Project'
      })
    )
  })
})
