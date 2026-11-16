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

// A refresh that fails, so a 401 from the backend ends the session.
vi.mock(
  '../common/helpers/auth/refresh-session.js',
  async (importOriginal) => ({
    ...(await importOriginal()),
    refreshSession: vi.fn().mockResolvedValue(false)
  })
)

const { getController } = await import('./controller.js')
const realUploader = await vi.importActual('../common/services/uploader.js')

const createMockH = () => {
  const response = {
    header: vi.fn().mockReturnThis(),
    code: vi.fn().mockReturnThis()
  }
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

    expect(initiateUpload).toHaveBeenCalledWith(request, {
      redirect: '/projects/proj-123/upload-received',
      s3Bucket: 'baseline-files',
      s3Path: 'baseline/',
      metadata: { projectId: 'proj-123', uploadType: 'baseline' }
    })
    expect(request.yar.set).toHaveBeenCalledWith('pendingUploadId', 'abc-123')
    expect(request.yar.clear).toHaveBeenCalledWith('uploadStartedAt')
    expect(h.view).toHaveBeenCalledWith(
      'common/templates/upload-geopackage-file',
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
      'common/templates/upload-geopackage-file',
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
      'common/templates/upload-geopackage-file',
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
      'common/templates/upload-geopackage-file',
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
      'common/templates/upload-geopackage-file',
      expect.objectContaining({
        pageTitle: 'Error: Upload Baseline File',
        error: { text: 'File must be a GeoPackage' }
      })
    )
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
          get: vi.fn((key) => (key === 'uploadError' ? stored : null)),
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
      'common/templates/upload-geopackage-file',
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

  // These run the real initiateUpload, failing at the backend call, so the
  // error the controller sees is the one initiateUpload really throws.
  describe('when the upload cannot start', () => {
    beforeEach(() => {
      vi.mocked(initiateUpload).mockImplementation(realUploader.initiateUpload)
    })

    const requestWithError = (stored) => {
      const request = createMockRequest()
      request.yar.get = vi.fn((key) => (key === 'uploadError' ? stored : null))
      return request
    }

    test('keeps the timeout message on the upload page, in place of the form', async () => {
      vi.mocked(wreck.post).mockRejectedValue(new Error('ECONNREFUSED'))
      const h = createMockH()
      const request = requestWithError('timedOut')

      await getController.handler(request, h)

      expect(h.view).toHaveBeenCalledWith(
        'common/templates/upload-geopackage-file',
        expect.objectContaining({
          pageTitle: 'Error: Upload Baseline File',
          uploadUrl: undefined,
          uploadUnavailableText:
            'Unable to start file upload. Please try again later.',
          error: { text: 'The file check timed out. Please try again.' }
        })
      )
      expect(h.view.mock.results[0].value.code).toHaveBeenCalledWith(502)
      expect(request.yar.clear).toHaveBeenCalledWith('uploadError')
      expect(request.yar.set).not.toHaveBeenCalledWith(
        'pendingUploadId',
        expect.anything()
      )
      expect(request.yar.clear).not.toHaveBeenCalledWith('uploadStartedAt')
    })

    test('still shows the error page when there is no message to keep', async () => {
      vi.mocked(wreck.post).mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(
        getController.handler(createMockRequest(), createMockH())
      ).rejects.toMatchObject({ output: { statusCode: 502 } })
    })

    test('still shows the "too many requests" page for a rate limit', async () => {
      const tooManyRequests = new Error('Response Error: 429 Too Many Requests')
      tooManyRequests.data = {
        isResponseError: true,
        res: { statusCode: 429, headers: { 'retry-after': '5' } }
      }
      vi.mocked(wreck.post).mockRejectedValue(tooManyRequests)

      await expect(
        getController.handler(requestWithError('timedOut'), createMockH())
      ).rejects.toMatchObject({
        output: { statusCode: 429 },
        data: { rateLimited: true }
      })
    })

    test('still sends an expired sign-in to sign in again', async () => {
      vi.mocked(wreck.post).mockResolvedValue({
        res: { statusCode: 401 },
        payload: {}
      })
      const request = requestWithError('timedOut')
      request.yar.reset = vi.fn()

      await expect(
        getController.handler(request, createMockH())
      ).rejects.toMatchObject({
        output: { statusCode: 401 },
        data: { sessionExpired: true }
      })
    })
  })
})
