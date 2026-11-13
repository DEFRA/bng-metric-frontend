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

  test.each([
    [
      'invalidName',
      'The file name can only include letters, numbers, spaces, hyphens, underscores, full stops or brackets'
    ],
    ['timedOut', 'The file check timed out. Please try again.'],
    [
      'The file check timed out. Please try again.',
      'The file check timed out. Please try again.'
    ]
  ])(
    'shows the session upload error %s as its words',
    async (stored, words) => {
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
            key === 'postInterventionUploadError' ? stored : null
          ),
          clear: vi.fn()
        }
      }

      await getController.handler(request, h)

      expect(h.view).toHaveBeenCalledWith(
        'common/templates/upload-geopackage-file',
        expect.objectContaining({ error: { text: words } })
      )
    }
  )

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
    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionUploadStartedAt'
    )
    expect(h.view).toHaveBeenCalledWith(
      'common/templates/upload-geopackage-file',
      expect.objectContaining({
        uploadUrl: '/upload-and-scan/abc-123',
        instructionText: expect.stringContaining('post-intervention')
      })
    )
  })
})
