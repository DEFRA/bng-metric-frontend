import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#defineProjectNameController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render the define project name page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Define Project Name | Biodiversity Net Gain')
    )
  })

  test('Should render the Project Name heading', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Project Name'))
  })

  test('Should render the hint text', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        'Enter a descriptive name to help you find your project later'
      )
    )
  })

  test('Should render the Save and continue button', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Save and continue'))
  })

  test('Should render a back link to the project dashboard', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('href="/project-dashboard"'))
    expect(result).toEqual(expect.stringContaining('govuk-back-link'))
  })

  test('Should render an input with maxlength of 1000', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/define-project-name'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('maxlength="1000"'))
    expect(result).toEqual(expect.stringContaining('type="text"'))
  })
})

describe('#defineProjectNamePostController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should POST to the backend with correct payload on valid input', async () => {
    await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'My Valid Project' }
    })

    expect(fetch).toHaveBeenCalledOnce()

    const [url, options] = fetch.mock.calls[0]
    const body = JSON.parse(options.body)

    expect(url).toContain('/projects/new')
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(body.project).toEqual({ name: 'My Valid Project' })
    expect(body.userId).toBe('test-user-003')
  })

  test('Should redirect to project dashboard on valid input', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'My Valid Project' }
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe('/project-dashboard')
  })

  test('Should render error page when backend returns a non-2xx response', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 })

    const { statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'My Valid Project' }
    })

    expect(statusCode).toBe(502)
  })

  test('Should show error summary when project name is empty', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: '' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(expect.stringContaining('Enter a project name'))
    expect(result).toEqual(
      expect.stringContaining(
        'Error: Define Project Name | Biodiversity Net Gain'
      )
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name exceeds 1000 characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'a'.repeat(1001) }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must be 1000 characters or fewer')
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show error summary when project name contains invalid characters', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'Invalid\x00Name' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('There is a problem'))
    expect(result).toEqual(
      expect.stringContaining('Project name must only contain valid characters')
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  test('Should show red error border on input when validation fails', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: '' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('govuk-form-group--error'))
    expect(result).toEqual(expect.stringContaining('govuk-input--error'))
  })

  test('Should repopulate the input with submitted value on error', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/define-project-name',
      payload: { projectName: 'My Project\x01' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('value="My Project'))
  })
})
