// @vitest-environment happy-dom
/* global DOMParser */
import { createServer } from '../server.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { fetchLocalPlanningAuthorities } from '../common/services/local-planning-authorities.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { loadPage } from '../test-helpers/load-page.js'
import { runAxeChecks } from '../test-helpers/axe-helper.js'
import { assertLayoutLandmarks } from '../test-helpers/assert-landmarks.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: { get: vi.fn(), patch: vi.fn() }
}))
vi.mock('../common/services/local-planning-authorities.js', () => ({
  fetchLocalPlanningAuthorities: vi.fn()
}))

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const url = `/project-details/${projectId}`

function projectWith(details) {
  return {
    res: { statusCode: 200 },
    payload: { project: { name: 'Project 1', baseline: {}, details } }
  }
}

describe('Project details page accessibility checks', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(fetchLocalPlanningAuthorities).mockResolvedValue([
      { name: 'Anytown Borough Council', reference: 'E60000001' }
    ])
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
  })

  it('should have no HTML accessibility issues with only the name saved', async () => {
    vi.mocked(wreck.get).mockResolvedValue(projectWith(undefined))
    const { document } = await loadPage({
      requestUrl: url,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues with every detail saved', async () => {
    vi.mocked(wreck.get).mockResolvedValue(
      projectWith({
        localPlanningAuthority: 'Anytown Borough Council',
        localPlanningAuthorityReference: 'E60000001',
        surveyCompleters: 'Jane Smith',
        surveyCompletionDate: '01/06/2025',
        applicant: 'Acme Developments Ltd',
        planningApplicationReference: '24/01234/FUL',
        planningApplicationType: 'Outline planning permission'
      })
    )
    const { document } = await loadPage({
      requestUrl: url,
      server,
      auth: authedAuth
    })
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })

  it('should have no HTML accessibility issues when the save is refused', async () => {
    vi.mocked(wreck.get).mockResolvedValue(projectWith(undefined))
    const crumb = await primeCrumb(server)
    const response = await server.inject({
      method: 'POST',
      url,
      payload: {
        projectName: ' ',
        'surveyCompletionDate-day': '31',
        'surveyCompletionDate-month': '',
        'surveyCompletionDate-year': '2025',
        crumb: crumb.token
      },
      headers: { cookie: crumb.cookie },
      auth: authedAuth
    })
    expect(response.statusCode).toBe(200)
    const document = new DOMParser().parseFromString(
      response.result,
      'text/html'
    )
    assertLayoutLandmarks(document)
    await runAxeChecks(document.documentElement)
  })
})
