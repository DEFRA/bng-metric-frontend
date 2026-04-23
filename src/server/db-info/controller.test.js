import Wreck from '@hapi/wreck'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'

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

    vi.spyOn(Wreck, 'get').mockResolvedValue({ payload: mockData })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/db-info'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('DB Info -'))
    expect(result).toEqual(expect.stringContaining('PostgreSQL 16.1'))
  })
})
