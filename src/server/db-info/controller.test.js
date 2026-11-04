import { createServer } from '../server.js'
import { config } from '../../config/config.js'
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

describe('#dbInfoController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const mockData = { version: 'PostgreSQL 16.1' }

    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: mockData
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/db-info'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('DB Info -'))
    expect(result).toEqual(expect.stringContaining('PostgreSQL 16.1'))
  })
})

describe('#dbInfo route in prod', () => {
  let server
  let environment

  beforeAll(async () => {
    environment = config.get('environment')
    config.set('environment', 'prod')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    config.set('environment', environment)
  })

  test('Should not be registered', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/db-info'
    })

    expect(statusCode).toBe(statusCodes.notFound)
    expect(wreck.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/db-info')
    )
  })
})
