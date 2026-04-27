import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

describe('#invalidFileController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('serves the page at /invalid-file', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/invalid-file'
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the expected page title', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file'
    })

    expect(result).toEqual(
      expect.stringContaining(
        '<title>Biodiversity Net Gain - Dropout Page</title>'
      )
    )
  })

  test('renders the placeholder body text', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file'
    })

    expect(result).toEqual(expect.stringContaining('Dropout Page (Skeleton)'))
  })
})
