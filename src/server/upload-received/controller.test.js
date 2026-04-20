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

  it('should validate and redirect to project page when status is ready', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({ valid: true })

    await getController.handler(request, h)

    expect(getUploadStatus).toHaveBeenCalledWith('test-upload-id')
    expect(validateBaseline).toHaveBeenCalledWith('test-upload-id')
    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(h.redirect).toHaveBeenCalledWith('/projects/proj-123/upload-result')
    expect(h.view).not.toHaveBeenCalled()
  })

  it('should redirect to upload page with error when validation fails', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({ uploadStatus: 'ready' })
    vi.mocked(validateBaseline).mockResolvedValue({
      valid: false,
      error: 'File is not a valid GeoPackage'
    })

    await getController.handler(request, h)

    expect(validateBaseline).toHaveBeenCalledWith('test-upload-id')
    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineError',
      'File is not a valid GeoPackage'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
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
      refreshInterval: 5
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
      refreshInterval: 5
    })
  })

  it('should redirect with virus error message when status is rejected', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'rejected',
      errorMessage: 'The selected file contains a virus'
    })

    await getController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('pendingUploadId')
    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineError',
      'The selected file contains a virus'
    )
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
  })

  it('should use fallback error message when rejected without errorMessage', async () => {
    const h = createMockH()
    const request = createMockRequest('test-upload-id')
    vi.mocked(getUploadStatus).mockResolvedValue({
      uploadStatus: 'rejected'
    })

    await getController.handler(request, h)

    expect(request.yar.set).toHaveBeenCalledWith(
      'baselineError',
      'The selected file was rejected'
    )
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
      refreshInterval: 5
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
      'baselineError',
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
})
