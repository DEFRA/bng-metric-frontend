import { getUploadStatus } from '../common/services/uploader.js'
import { validatePostIntervention } from '../common/services/baseline.js'

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
  const store = { postInterventionPendingUploadId: uploadId, ...sessionData }
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

describe('post-intervention-upload-received controller', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('redirects to post-intervention upload page when no uploadId is in session', async () => {
    const h = createMockH()
    const request = createMockRequest(null)

    await getController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-post-intervention-file'
    )
  })

  test('validates and redirects to post-intervention habitat list when ready', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({ valid: true })

    await getController.handler(request, h)

    expect(validatePostIntervention).toHaveBeenCalledWith(
      request,
      'proj-123',
      'test-upload-id'
    )
    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionPendingUploadId'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/post-intervention-habitat-list'
    )
  })

  test('clears post-intervention upload timer after successful upload', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id', 'proj-123', {
      postInterventionUploadStartedAt: Date.now() - 10 * 1000
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({ valid: true })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionUploadStartedAt'
    )
  })

  test('stores post-intervention validation errors before dropout redirect', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    const errors = [{ code: 'NO_HABITAT_AREAS', message: 'No habitats' }]
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({
      valid: false,
      errors
    })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionValidationErrors',
      errors
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionValidationErrorsProjectId',
      'proj-123'
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'validationUploadType',
      'postIntervention'
    )
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  test.each([['GPKG_INVALID_FILE'], ['GPKG_NOT_A_GEOPACKAGE']])(
    'redirects to the post-intervention upload page with the format-error flash when validation fails with %s',
    async (code) => {
      const h = createMockH()
      const request = createMockRequest('test-upload-id')
      vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
      vi.mocked(validatePostIntervention).mockResolvedValue({
        valid: false,
        errors: [{ code, message: 'File is not a valid GeoPackage' }]
      })

      await getController.handler(request, h)

      expect(request.yar.set).toHaveBeenCalledWith(
        'postInterventionUploadError',
        'The selected file must be a GeoPackage (.gpkg)'
      )
      expect(request.yar.set).not.toHaveBeenCalledWith(
        'postInterventionValidationErrors',
        expect.anything()
      )
      expect(h.redirect).toHaveBeenCalledWith(
        '/projects/proj-123/upload-post-intervention-file'
      )
    }
  )

  test('defaults to an empty errors array when post-intervention validation fails without errors', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({ valid: false })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionValidationErrors',
      []
    )
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  test('renders processing view with post-intervention upload back link', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'pending' })

    await getController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('upload-received/upload-received', {
      pageTitle: 'Checking your file',
      heading: 'Checking your file',
      projectId: 'proj-123',
      backHref: '/projects/proj-123/upload-post-intervention-file',
      refreshInterval: expect.any(Number) // jittered — see the range test
    })
  })

  test('redirects to dropout page when post-intervention upload is rejected', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'rejected',
      errorMessage: 'The selected file contains a virus'
    })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionPendingUploadId'
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionValidationErrors',
      []
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionValidationErrorsProjectId',
      'proj-123'
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'validationUploadType',
      'postIntervention'
    )
    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  test('renders processing view for unrecognised post-intervention upload status', async () => {
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
      backHref: '/projects/proj-123/upload-post-intervention-file',
      refreshInterval: expect.any(Number) // jittered — see the range test
    })
  })

  test('redirects with post-intervention timeout error when max wait time exceeded', async () => {
    const h = createMockH()
    const expiredStart = Date.now() - 121 * 1000
    const request = createMockRequest('test-upload-id', 'proj-123', {
      postInterventionUploadStartedAt: expiredStart
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'pending' })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionPendingUploadId'
    )
    expect(request.yar.clear).toHaveBeenCalledWith(
      'postInterventionUploadStartedAt'
    )
    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionUploadError',
      'The file check timed out. Please try again.'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-post-intervention-file'
    )
  })

  // A busy backend is not a bad file, and it is not a reason to give up: the
  // user stays on the polling page and its meta-refresh retries.
  it('should keep the user on the polling page when the service is busy', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({
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
    vi.mocked(validatePostIntervention).mockResolvedValue({
      valid: false,
      busy: true
    })

    await getController.handler(request, h)

    expect(request.yar.clear).not.toHaveBeenCalled()
  })

  it('should give up once the service has been busy past the maximum wait', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id', 'proj-123', {
      postInterventionUploadStartedAt: Date.now() - 121_000
    })
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({
      valid: false,
      busy: true
    })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'postInterventionUploadError',
      'The service is busy checking other files. Please try again in a few moments.'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-post-intervention-file'
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

  // The backend sets the pace via Retry-After; the jitter stays on this side.
  it('should pace the retry from the backend Retry-After when given one', async () => {
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({
      valid: false,
      busy: true,
      retryAfterSeconds: 12
    })

    const h = createMockH()
    await getController.handler(createMockRequest('test-upload-id'), h)

    const { refreshInterval } = h.view.mock.calls.at(-1)[1]
    expect(refreshInterval).toBeGreaterThanOrEqual(12)
    expect(refreshInterval).toBeLessThanOrEqual(15)
  })

  it('should fall back to its own interval when the backend gives no pace', async () => {
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validatePostIntervention).mockResolvedValue({
      valid: false,
      busy: true,
      retryAfterSeconds: null
    })

    const h = createMockH()
    await getController.handler(createMockRequest('test-upload-id'), h)

    const { refreshInterval } = h.view.mock.calls.at(-1)[1]
    expect(refreshInterval).toBeGreaterThanOrEqual(5)
    expect(refreshInterval).toBeLessThanOrEqual(8)
  })
})
