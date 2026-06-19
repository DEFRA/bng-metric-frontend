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

describe('upload-post-intervention-file controller', () => {
  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Test Project' } }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders form and initiates upload with post-intervention metadata', async () => {
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'abc-123',
      uploadUrl: '/upload-and-scan/abc-123'
    })

    const h = createMockH()
    const request = createMockRequest()

    await getController.handler(request, h)

    expect(initiateUpload).toHaveBeenCalledWith(request, {
      redirect: '/projects/proj-123/post-intervention-upload-received',
      s3Bucket: 'baseline-files',
      s3Path: 'baseline/',
      metadata: { projectId: 'proj-123', uploadType: 'postIntervention' }
    })
    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionPendingUploadId',
      'abc-123'
    )
    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        uploadUrl: '/upload-and-scan/abc-123',
        instructionText: expect.stringContaining('post-intervention')
      })
    )
  })
})
