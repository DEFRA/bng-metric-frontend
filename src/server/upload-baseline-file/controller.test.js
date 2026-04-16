import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

const mockProject = {
  project: {
    name: 'Greenfield Meadow Restoration'
  }
}

const projectId = 'aaa-bbb-ccc'
const url = `/projects/${projectId}/upload-baseline-file`

describe('#uploadBaselineFile - GET', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProject)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should render the page with correct title', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Biodiversity Net Gain - Upload Baseline File')
    )
  })

  test('Should show the page heading', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(expect.stringContaining('Upload a GeoPackage file'))
  })

  test('Should show the project name as caption', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(
      expect.stringContaining('Greenfield Meadow Restoration')
    )
  })

  test('Should render the file upload component with .gpkg accept', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(expect.stringContaining('accept=".gpkg"'))
    expect(result).toEqual(expect.stringContaining('id="file"'))
  })

  test('Should show the back link to the project', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(
      expect.stringContaining(`href="/projects/${projectId}"`)
    )
    expect(result).toEqual(expect.stringContaining('Back'))
  })

  test('Should show the cancel link to the project', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(expect.stringContaining('Cancel'))
  })

  test('Should show the details component', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url
    })

    expect(result).toEqual(
      expect.stringContaining('What layers should my file contain?')
    )
  })
})

describe('#uploadBaselineFile - POST without file', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProject)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should return 400 with error message when no file is uploaded', async () => {
    const { result, statusCode } = await server.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary'
      },
      payload:
        '--boundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename=""\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n' +
        '\r\n' +
        '--boundary--\r\n'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toEqual(
      expect.stringContaining('Select a GeoPackage (.gpkg) file')
    )
  })

  test('Should show error summary when no file is uploaded', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary'
      },
      payload:
        '--boundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename=""\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n' +
        '\r\n' +
        '--boundary--\r\n'
    })

    expect(result).toEqual(expect.stringContaining('There is a problem'))
  })

  test('Should prefix page title with Error when validation fails', async () => {
    const { result } = await server.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary'
      },
      payload:
        '--boundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename=""\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n' +
        '\r\n' +
        '--boundary--\r\n'
    })

    expect(result).toEqual(
      expect.stringContaining(
        'Error: Biodiversity Net Gain - Upload Baseline File'
      )
    )
  })
})

describe('#uploadBaselineFile - POST with file', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(mockProject)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should redirect when a file is provided', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'POST',
      url,
      headers: {
        'content-type': 'multipart/form-data; boundary=boundary'
      },
      payload:
        '--boundary\r\n' +
        'Content-Disposition: form-data; name="file"; filename="test.gpkg"\r\n' +
        'Content-Type: application/octet-stream\r\n\r\n' +
        'fakecontent\r\n' +
        '--boundary--\r\n'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(`/projects/${projectId}`)
  })
})
