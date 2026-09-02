import { getUploadStatus } from '../common/services/uploader.js'
import { validateBaseline } from '../common/services/baseline.js'

vi.mock('../common/services/uploader.js')
vi.mock('../common/services/baseline.js')

const { getController } = await import('./controller.js')

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

const createMockRequest = (
  uploadId = null,
  projectId = 'proj-123',
  sessionData = {}
) => {
  const store = { pendingUploadId: uploadId, ...sessionData }
  return {
    params: { id: projectId },
    yar: {
      get: vi.fn((key) => store[key] ?? null),
      set: vi.fn((key, value) => {
        store[key] = value
      }),
      clear: vi.fn((key) => {
        delete store[key]
      })
    }
  }
}

describe('upload-received controller', () => {
  it('should redirect to upload page when no uploadId in session', async () => {
    const h = createMockH()
    const request = createMockRequest(null)

    await getController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
  })

  it('should validate and redirect to project summary when status is ready', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: true })

    await getController.handler(request, h)

    expect(getUploadStatus).toHaveBeenCalledWith(request, 'test-upload-id')
    expect(validateBaseline).toHaveBeenCalledWith(
      request,
      'proj-123',
      'test-upload-id'
    )
    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/project-summary'
    )
    expect(h.view).not.toHaveBeenCalled()
  })

  it('should redirect to dropout page with structured errors when validation fails', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    const errors = [
      { code: 'NO_HABITAT_AREAS', ac: 'AC3', message: 'No habitat areas' }
    ]
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({
      valid: false,
      errors
    })

    await getController.handler(request, h)

    expect(validateBaseline).toHaveBeenCalledWith(
      request,
      'proj-123',
      'test-upload-id'
    )
    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineValidationErrors',
      errors
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineValidationErrorsProjectId',
      'proj-123'
    )
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  it.each([['GPKG_INVALID_FILE'], ['GPKG_NOT_A_GEOPACKAGE']])(
    'should redirect to the upload page with the format-error flash when validation fails with %s',
    async (code) => {
      const h = createMockH()
      const request = createMockRequest('test-upload-id')
      vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
      vi.mocked(validateBaseline).mockResolvedValue({
        valid: false,
        errors: [{ code, message: 'File is not a valid GeoPackage' }]
      })

      await getController.handler(request, h)

      expect(request.yar.set).toHaveBeenCalledWith(
        'uploadError',
        'The selected file must be a GeoPackage (.gpkg)'
      )
      expect(request.yar.set).not.toHaveBeenCalledWith(
        'baselineValidationErrors',
        expect.anything()
      )
      expect(h.redirect).toHaveBeenCalledWith(
        '/projects/proj-123/upload-baseline-file'
      )
    }
  )

  it('should default to an empty errors array when validation fails without errors', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: false })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith('baselineValidationErrors', [])
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  it('should render processing view when status is pending', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'pending' })

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('upload-received/upload-received', {
      pageTitle: 'Checking your file',
      heading: 'Checking your file',
      projectId: 'proj-123',
      backHref: '/projects/proj-123/upload-baseline-file',
      refreshInterval: expect.any(Number) // jittered — see the range test
    })
  })

  it('should render processing view when status is initiated', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'initiated'
    })

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('upload-received/upload-received', {
      pageTitle: 'Checking your file',
      heading: 'Checking your file',
      projectId: 'proj-123',
      backHref: '/projects/proj-123/upload-baseline-file',
      refreshInterval: expect.any(Number) // jittered — see the range test
    })
  })

  it('should redirect to dropout page when status is rejected', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'rejected',
      errorMessage: 'The selected file contains a virus'
    })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.set).toHaveBeenCalledWith('baselineValidationErrors', [])
    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineValidationErrorsProjectId',
      'proj-123'
    )
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  it('should render processing view for unrecognised status', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'error',
      error: 'Unable to check upload status'
    })

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('upload-received/upload-received', {
      pageTitle: 'Checking your file',
      heading: 'Checking your file',
      projectId: 'proj-123',
      backHref: '/projects/proj-123/upload-baseline-file',
      refreshInterval: expect.any(Number) // jittered — see the range test
    })
  })

  it('should redirect with timeout error when max wait time exceeded', async () => {
    const h = createMockH()
    const expiredStart = Date.now() - 121 * 1000
    const request = createMockRequest('test-upload-id', 'proj-123', {
      uploadStartedAt: expiredStart
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'pending' })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.clear).toHaveBeenCalledWith('uploadStartedAt')
    expect(request.yar.set).toHaveBeenCalledWith(
      'uploadError',
      'The file check timed out. Please try again.'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
  })

  it('should clear uploadStartedAt on successful upload', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id', 'proj-123', {
      uploadStartedAt: Date.now() - 10 * 1000
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: true })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('uploadStartedAt')
  })

  // A busy backend is not a bad file, and it is not a reason to give up: the
  // user stays on the polling page and its meta-refresh retries.
  it('should keep the user on the polling page when the service is busy', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({
      valid: false,
      busy: true,
      errors: []
    })

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload-received/upload-received',
      expect.objectContaining({ refreshInterval: expect.any(Number) })
    )
    expect(h.redirect).not.toHaveBeenCalled()
  })

  it('should keep the pending upload in session so the retry still has an id', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: false, busy: true })

    await getController.handler(request, h)

    expect(request.yar.clear).not.toHaveBeenCalled()
  })

  it('should give up once the service has been busy past the maximum wait', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id', 'proj-123', {
      uploadStartedAt: Date.now() - 121_000
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: false, busy: true })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'uploadError',
      'The service is busy checking other files. Please try again in a few moments.'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
    expect(h.redirect).not.toHaveBeenCalledWith('/error-file')
  })

  // The interval is jittered so that browsers waiting on a busy validator do not
  // all retry on the same tick — a small fixed worker pool sees a burst every
  // five seconds and idles in between, which is the worst arrival pattern for it.
  it('should jitter the refresh interval within a sensible range', async () => {
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'pending' })
    const intervals = new Set()

    for (let attempt = 0; attempt < 20; attempt++) {
      const h = createMockH()
      await getController.handler(createMockRequest('test-upload-id'), h)
      const { refreshInterval } = h.view.mock.calls.at(-1)[1]
      expect(refreshInterval).toBeGreaterThanOrEqual(5)
      expect(refreshInterval).toBeLessThanOrEqual(8)
      intervals.add(refreshInterval)
    }

    expect(intervals.size).toBeGreaterThan(1)
  })
})
