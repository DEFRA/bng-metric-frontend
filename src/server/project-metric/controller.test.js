import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { metricFilename } from './controller.js'

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
const WORKBOOK = Buffer.from('PK pretend workbook')
const XLSM_TYPE = 'application/vnd.ms-excel.sheet.macroEnabled.12'
const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
// 3 November 2026, mid-morning in London.
const DOWNLOAD_DAY = new Date('2026-11-03T10:00:00Z')

const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectWithBaseline = {
  project: { name: 'Riverside Farm', baseline: { habitats: [{}] } }
}

function respond(statusCode, payload) {
  return { res: { statusCode }, payload }
}

function backendError(statusCode, headers = {}) {
  const error = new Error(`Response Error: ${statusCode}`)
  error.data = { isResponseError: true, res: { statusCode, headers } }
  return error
}

/** The project read for the filename, then the workbook itself. */
function backendAnswers({ project = projectWithBaseline, workbook } = {}) {
  vi.mocked(wreck.get).mockImplementation(async (url) => {
    if (/\/metric\.xls[mx]$/.test(url)) {
      return workbook ? workbook() : respond(statusCodes.ok, WORKBOOK)
    }
    return project instanceof Error
      ? Promise.reject(project)
      : respond(statusCodes.ok, project)
  })
}

function getMetric(server, format = 'xlsm', options = {}) {
  return server.inject({
    method: 'GET',
    url: `/projects/${PROJECT_ID}/metric.${format}`,
    auth,
    ...options
  })
}

function workbookCalls() {
  return vi
    .mocked(wreck.get)
    .mock.calls.filter(([url]) => /\/metric\.xls[mx]$/.test(url))
}

describe('metric workbook download', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.useFakeTimers({ now: DOWNLOAD_DAY, toFake: ['Date'] })
    backendAnswers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  test.each([
    ['xlsm', XLSM_TYPE],
    ['xlsx', XLSX_TYPE]
  ])(
    'returns the %s workbook as a download of its own type',
    async (format, type) => {
      const response = await getMetric(server, format)

      expect(response.statusCode).toBe(statusCodes.ok)
      expect(response.headers['content-type']).toBe(type)
      expect(response.headers['content-disposition']).toBe(
        `attachment; filename="Riverside Farm-metric-2026-11-03.${format}"`
      )
      expect(response.rawPayload).toEqual(WORKBOOK)
    }
  )

  test('asks the backend for this format of this project, not parsed as JSON', async () => {
    await getMetric(server, 'xlsx')

    expect(workbookCalls()).toHaveLength(1)
    const [url, options] = workbookCalls()[0]
    expect(url).toMatch(new RegExp(`/projects/${PROJECT_ID}/metric\\.xlsx$`))
    expect(options).toMatchObject({ json: false })
  })

  test('is still downloaded while the project has unresolved actions (AC6)', async () => {
    backendAnswers({
      project: {
        project: projectWithBaseline.project,
        tradingRuleStatuses: { habitats: 'notMet' }
      }
    })

    expect((await getMetric(server)).statusCode).toBe(statusCodes.ok)
  })

  test('shows "Page not found" for a project with no baseline, without building one (AC11)', async () => {
    backendAnswers({ project: { project: { name: 'Riverside Farm' } } })

    const response = await getMetric(server)

    expect(response.statusCode).toBe(statusCodes.notFound)
    expect(response.result).toContain('Page not found')
    expect(workbookCalls()).toHaveLength(0)
  })

  test('returns not found for a project the user cannot see', async () => {
    backendAnswers({ project: backendError(statusCodes.notFound) })

    expect((await getMetric(server)).statusCode).toBe(statusCodes.notFound)
    expect(workbookCalls()).toHaveLength(0)
  })

  test('returns not found when the backend has no such workbook', async () => {
    backendAnswers({
      workbook: () => Promise.reject(backendError(statusCodes.notFound))
    })

    expect((await getMetric(server)).statusCode).toBe(statusCodes.notFound)
  })

  test.each([
    [
      'cannot build the file',
      () => Promise.reject(backendError(statusCodes.internalServerError))
    ],
    ['is unreachable', () => Promise.reject(new Error('ECONNREFUSED'))],
    ['answers 200 with no bytes', () => respond(statusCodes.ok, null)],
    [
      'answers 200 with an empty body',
      () => respond(statusCodes.ok, Buffer.alloc(0))
    ]
  ])(
    'shows an error page and sends no file when the backend %s (AC13)',
    async (_, workbook) => {
      backendAnswers({ workbook })

      const response = await getMetric(server)

      expect(response.statusCode).toBe(statusCodes.badGateway)
      expect(response.headers['content-type']).toMatch(/^text\/html/)
      expect(response.headers['content-disposition']).toBeUndefined()
    }
  )

  test('asks the user to wait and try again, with the backend’s wait, when every build slot is busy', async () => {
    backendAnswers({
      workbook: () =>
        Promise.reject(
          backendError(statusCodes.serviceUnavailable, { 'retry-after': '5' })
        )
    })

    const response = await getMetric(server)

    expect(response.statusCode).toBe(statusCodes.serviceUnavailable)
    expect(response.headers['retry-after']).toBe('5')
    expect(response.headers['content-disposition']).toBeUndefined()
    expect(response.result).toContain('Sorry, the service is busy')
    expect(response.result).toContain('Wait 5 seconds, then try again.')
  })

  test('sends the user to the session-expired page, not a file, when the session cannot be refreshed (AC9)', async () => {
    const expired = new Error('session expired')
    expired.data = { sessionExpired: true }
    backendAnswers({ workbook: () => Promise.reject(expired) })

    const response = await getMetric(server)

    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe('/auth/session-expired')
    expect(response.headers['content-disposition']).toBeUndefined()
  })

  test('sends a user who is not signed in to sign in (AC10)', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/metric.xlsm`
    })

    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers['content-disposition']).toBeUndefined()
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires an approved BNG completer role', async () => {
    const response = await getMetric(server, 'xlsm', {
      auth: { ...auth, credentials: { ...auth.credentials, roles: [] } }
    })

    expect(response.statusCode).toBe(statusCodes.redirect)
    expect(response.headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('rejects a format it does not make', async () => {
    expect((await getMetric(server, 'xls')).statusCode).toBe(
      statusCodes.badRequest
    )
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('rejects an invalid project id', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/metric.xlsm',
      auth
    })

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })
})

describe('#metricFilename', () => {
  test('is the project name, "metric", the date and the extension (AC7)', () => {
    expect(metricFilename('Riverside Farm', 'xlsm', DOWNLOAD_DAY)).toBe(
      'Riverside Farm-metric-2026-11-03.xlsm'
    )
    expect(metricFilename('Riverside Farm', 'xlsx', DOWNLOAD_DAY)).toBe(
      'Riverside Farm-metric-2026-11-03.xlsx'
    )
  })

  test("uses the London date, not the server's UTC one", () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST).
    expect(
      metricFilename('Site', 'xlsx', new Date('2026-06-30T23:30:00Z'))
    ).toBe('Site-metric-2026-07-01.xlsx')
  })

  test('replaces characters that are not safe in a file name', () => {
    expect(metricFilename('Farm "A"/B: phase 2', 'xlsx', DOWNLOAD_DAY)).toBe(
      'Farm -A--B- phase 2-metric-2026-11-03.xlsx'
    )
  })

  test.each([['///'], ['"<>"'], [''], [undefined], ['   ']])(
    'uses the fallback name when %j has nothing safe left in it (AC8)',
    (name) => {
      expect(metricFilename(name, 'xlsm', DOWNLOAD_DAY)).toBe(
        'bng-site-metric-2026-11-03.xlsm'
      )
    }
  )

  test('keeps a long name to 80 characters', () => {
    const filename = metricFilename('a'.repeat(200), 'xlsx', DOWNLOAD_DAY)

    expect(filename).toBe(`${'a'.repeat(80)}-metric-2026-11-03.xlsx`)
  })
})
