import { getValidationJobStatus } from '../common/services/baseline.js'

vi.mock('../common/services/baseline.js')

const { baselineValidatingController } = await import('./controller.js')

const createMockH = () => ({
  view: vi.fn().mockReturnThis(),
  redirect: vi.fn().mockReturnThis()
})

const createMockRequest = (jobId = null, projectId = 'proj-123') => {
  const store = {
    pendingValidationJobId: jobId,
    validationStartedAt: Date.now()
  }
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

describe('baseline validating controller', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to the upload page when there is no pending job', async () => {
    const h = createMockH()
    const request = createMockRequest(null)

    await baselineValidatingController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/upload-baseline-file'
    )
  })

  it('redirects to the habitat list when the job succeeded and the file is valid', async () => {
    const h = createMockH()
    const request = createMockRequest('job-1')
    vi.mocked(getValidationJobStatus).mockResolvedValue({
      status: 'succeeded',
      result: { valid: true }
    })

    await baselineValidatingController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('pendingValidationJobId')
    expect(h.redirect).toHaveBeenCalledWith(
      '/projects/proj-123/baseline-habitat-list'
    )
  })

  it('redirects to the dropout page when the job succeeded with validation errors', async () => {
    const h = createMockH()
    const request = createMockRequest('job-1')
    vi.mocked(getValidationJobStatus).mockResolvedValue({
      status: 'succeeded',
      result: {
        valid: false,
        errors: [{ code: 'NO_HABITAT_AREAS', message: 'x' }]
      }
    })

    await baselineValidatingController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  it('redirects to the dropout page when the job failed', async () => {
    const h = createMockH()
    const request = createMockRequest('job-1')
    vi.mocked(getValidationJobStatus).mockResolvedValue({
      status: 'failed',
      statusCode: 500,
      error: 'Unable to validate baseline file'
    })

    await baselineValidatingController.handler(request, h)

    expect(h.redirect).toHaveBeenCalledWith('/error-file')
  })

  it('re-renders the checking screen while the job is still processing', async () => {
    const h = createMockH()
    const request = createMockRequest('job-1')
    vi.mocked(getValidationJobStatus).mockResolvedValue({
      status: 'processing'
    })

    await baselineValidatingController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'upload-received/upload-received',
      expect.objectContaining({ refreshInterval: 5 })
    )
  })
})
