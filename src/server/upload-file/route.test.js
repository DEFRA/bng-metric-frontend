import { load } from 'cheerio'
import { createServer } from '../server.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { wreck } from '../common/helpers/wreck-client.js'
import {
  BASELINE_REQUIRED_ERROR,
  FILE_TYPES,
  SELECT_FILE_TYPE_ERROR
} from './controller.js'

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
const ROUTE = `/projects/${PROJECT_ID}/upload-file`
const TASK_LIST = `/add-project-details/${PROJECT_ID}`
const AUTH = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['relationship:bng completer:3']
  }
}

function mockProject(project = {}) {
  vi.mocked(wreck.get).mockResolvedValue({
    res: { statusCode: 200 },
    payload: { project: { name: 'Habitat project', ...project } }
  })
}

describe('upload file routes', () => {
  let server
  let crumb

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
    crumb = await primeCrumb(server)
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockProject()
  })

  test('blocks a request without a usable authenticated role', async () => {
    const response = await server.inject({
      method: 'GET',
      url: ROUTE
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires an approved BNG completer role', async () => {
    const response = await server.inject({
      method: 'GET',
      url: ROUTE,
      auth: {
        strategy: 'session',
        credentials: { ...AUTH.credentials, roles: [] }
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('rejects an invalid project ID', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/upload-file',
      auth: AUTH
    })

    expect(response.statusCode).toBe(400)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('renders the complete selection page', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `${ROUTE}?returnUrl=${encodeURIComponent(TASK_LIST)}`,
      auth: AUTH
    })

    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    const cancel = $('a.govuk-link').filter(
      (_index, element) => $(element).text().trim() === 'Cancel'
    )

    expect($('.govuk-caption-m').text()).toContain('Habitat project')
    expect($('h1').text()).toContain('What would you like to upload?')
    expect($('main').text()).toContain(
      'Uploading a file will overwrite any previous files you have uploaded.'
    )
    expect($(`label[for="uploadType"]`).text()).toContain(
      FILE_TYPES.baseline.text
    )
    expect($(`label[for="uploadType-2"]`).text()).toContain(
      FILE_TYPES.postIntervention.text
    )
    expect($('button[type="submit"]').text()).toContain('Continue')
    expect($('a.govuk-back-link').attr('href')).toBe(TASK_LIST)
    expect(cancel.attr('href')).toBe(TASK_LIST)
  })

  test('rejects a POST without a CSRF token', async () => {
    const response = await server.inject({
      method: 'POST',
      url: ROUTE,
      auth: AUTH,
      payload: {
        uploadType: FILE_TYPES.baseline.value,
        returnUrl: TASK_LIST
      }
    })

    expect(response.statusCode).toBe(403)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('redirects a baseline selection to the baseline chooser', async () => {
    const response = await server.inject({
      method: 'POST',
      url: ROUTE,
      auth: AUTH,
      headers: { cookie: crumb.cookie },
      payload: {
        crumb: crumb.token,
        uploadType: FILE_TYPES.baseline.value,
        returnUrl: TASK_LIST
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      `/projects/${PROJECT_ID}/upload-baseline-file?returnUrl=%2Fadd-project-details%2F${PROJECT_ID}`
    )
  })

  test('redirects a PI selection when the project has baseline data', async () => {
    mockProject({ baseline: { uploadId: 'baseline-upload' } })

    const response = await server.inject({
      method: 'POST',
      url: ROUTE,
      auth: AUTH,
      headers: { cookie: crumb.cookie },
      payload: {
        crumb: crumb.token,
        uploadType: FILE_TYPES.postIntervention.value,
        returnUrl: TASK_LIST
      }
    })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe(
      `/projects/${PROJECT_ID}/upload-post-intervention-file?returnUrl=%2Fadd-project-details%2F${PROJECT_ID}`
    )
  })

  test('renders both PI-without-baseline errors and retains the selection', async () => {
    const response = await server.inject({
      method: 'POST',
      url: ROUTE,
      auth: AUTH,
      headers: { cookie: crumb.cookie },
      payload: {
        crumb: crumb.token,
        uploadType: FILE_TYPES.postIntervention.value,
        returnUrl: TASK_LIST
      }
    })

    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    expect(
      response.result.match(new RegExp(BASELINE_REQUIRED_ERROR, 'g'))
    ).toHaveLength(2)
    expect($('#uploadType-2').is(':checked')).toBe(true)
    expect($('title').text()).toContain('Error: What would you like to upload?')
  })

  test('renders both errors when no upload type is selected', async () => {
    const response = await server.inject({
      method: 'POST',
      url: ROUTE,
      auth: AUTH,
      headers: { cookie: crumb.cookie },
      payload: {
        crumb: crumb.token,
        returnUrl: TASK_LIST
      }
    })

    expect(response.statusCode).toBe(200)
    expect(
      response.result.match(new RegExp(SELECT_FILE_TYPE_ERROR, 'g'))
    ).toHaveLength(2)
  })

  test('does not redirect Back or Cancel to an external URL', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `${ROUTE}?returnUrl=${encodeURIComponent('https://example.com')}`,
      auth: AUTH
    })

    expect(response.statusCode).toBe(200)
    const $ = load(response.result)
    const cancel = $('a.govuk-link').filter(
      (_index, element) => $(element).text().trim() === 'Cancel'
    )

    expect(response.result).not.toContain('https://example.com')
    expect($('a.govuk-back-link').attr('href')).toBe(TASK_LIST)
    expect(cancel.attr('href')).toBe(TASK_LIST)
  })
})
