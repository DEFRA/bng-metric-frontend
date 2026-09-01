import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const PDF = Buffer.from('%PDF-1.5 pretend report')

const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

function getReport(server, options = {}) {
  return server.inject({
    method: 'GET',
    url: `/projects/${PROJECT_ID}/report.pdf`,
    auth,
    ...options
  })
}

describe('project report', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: PDF
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('returns the backend PDF as a download', async () => {
    const response = await getReport(server)

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.headers['content-type']).toBe('application/pdf')
    expect(response.headers['content-disposition']).toBe(
      `attachment; filename="bng-site-report-${PROJECT_ID}.pdf"`
    )
    expect(response.rawPayload).toEqual(PDF)
  })

  test('asks the backend not to parse the response as JSON', async () => {
    // wreck-client defaults every call to `json: true`, which would have Wreck
    // parse the PDF bytes and throw on the first one.
    await getReport(server)

    expect(wreck.get).toHaveBeenCalledWith(
      expect.stringContaining(`/projects/${PROJECT_ID}/report.pdf`),
      expect.objectContaining({ json: false })
    )
  })

  test('asks the backend for this project report', async () => {
    // The bearer token is attached by backend-request.js, which has its own
    // tests; what belongs here is that the right URL is called through it.
    await getReport(server)

    expect(wreck.get).toHaveBeenCalledTimes(1)
    expect(vi.mocked(wreck.get).mock.calls[0][0]).toMatch(
      new RegExp(`/projects/${PROJECT_ID}/report\\.pdf$`)
    )
  })

  test('returns not found when the backend has no such project', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.notFound },
      payload: null
    })

    expect((await getReport(server)).statusCode).toBe(statusCodes.notFound)
  })

  test('returns bad gateway when the backend is unreachable', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('ECONNREFUSED'))

    expect((await getReport(server)).statusCode).toBe(statusCodes.badGateway)
  })

  test('returns bad gateway for an unsuccessful backend response', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.internalServerError },
      payload: null
    })

    expect((await getReport(server)).statusCode).toBe(statusCodes.badGateway)
  })

  test('returns bad gateway when the backend answers 200 with no bytes', async () => {
    // An empty 200 would otherwise be served to the browser as a zero-byte
    // "PDF" that no reader can open.
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: null
    })

    expect((await getReport(server)).statusCode).toBe(statusCodes.badGateway)
  })

  test('rejects an invalid project id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/report.pdf',
      auth
    })

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/report.pdf`
    })

    expect(response.statusCode).toBe(statusCodes.redirect)
  })

  test('requires an approved BNG completer role', async () => {
    const response = await getReport(server, {
      auth: { ...auth, credentials: { ...auth.credentials, roles: [] } }
    })

    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })
})
