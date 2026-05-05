import { vi, describe, test, beforeAll, afterAll, expect } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { invalidFileController } from './controller.js'

const authCredentials = {
  sub: 'test-user-123',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

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
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the expected page title', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(
        '<title>Biodiversity Net Gain - There is a problem with your file</title>'
      )
    )
  })

  test('renders fallback copy when no baseline errors are in session', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('There is a problem with your file')
    )
    expect(result).toEqual(expect.stringContaining("couldn't accept your file"))
  })

  test('redirects unauthenticated requests', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/invalid-file'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})

describe('invalidFileController.handler — populated session', () => {
  const makeRequest = (sessionData) => {
    const store = { ...sessionData }
    return {
      yar: {
        get: vi.fn((key) => store[key] ?? null),
        set: vi.fn(),
        clear: vi.fn((key) => {
          delete store[key]
        })
      }
    }
  }

  const makeH = () => ({ view: vi.fn().mockReturnThis() })

  test('passes errorList and projectId to the view from session', async () => {
    const errors = [
      { code: 'NO_HABITAT_AREAS', message: 'No habitat areas' },
      { code: 'REDLINE_INVALID_GEOMETRY', message: 'Redline invalid' }
    ]
    const request = makeRequest({
      baselineValidationErrors: errors,
      baselineValidationErrorsProjectId: 'proj-456'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'invalid-file/index',
      expect.objectContaining({
        errorList: [{ text: 'No habitat areas' }, { text: 'Redline invalid' }],
        projectId: 'proj-456'
      })
    )
  })

  test('clears both session keys after rendering', async () => {
    const request = makeRequest({
      baselineValidationErrors: [{ code: 'X', message: 'x' }],
      baselineValidationErrorsProjectId: 'proj-456'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('baselineValidationErrors')
    expect(request.yar.clear).toHaveBeenCalledWith(
      'baselineValidationErrorsProjectId'
    )
  })

  test('passes empty errorList and null projectId when session is empty', async () => {
    const request = makeRequest({})
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'invalid-file/index',
      expect.objectContaining({ errorList: [], projectId: null })
    )
  })
})
