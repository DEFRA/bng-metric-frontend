import { catchAll, serviceBusyPage } from './errors.js'
import { serviceBusyError } from './service-busy.js'
import { createServer } from '../../server.js'
import { statusCodes } from '../constants.js'

describe('#errors', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected Not Found page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/non-existent-path'
    })

    expect(result).toEqual(
      expect.stringContaining('Page not found - Biodiversity Net Gain')
    )
    expect(statusCode).toBe(statusCodes.notFound)
  })
})

describe('#catchAll', () => {
  const mockErrorLogger = vi.fn()
  const mockStack = 'Mock error stack'
  const errorPage = 'error/index'
  const mockRequest = (statusCode) => ({
    response: {
      isBoom: true,
      stack: mockStack,
      output: {
        statusCode
      }
    },
    logger: { error: mockErrorLogger }
  })
  const mockToolkitView = vi.fn()
  const mockToolkitCode = vi.fn()
  const mockToolkit = {
    view: mockToolkitView.mockReturnThis(),
    code: mockToolkitCode.mockReturnThis()
  }

  test('Should provide expected "Not Found" page', () => {
    catchAll(mockRequest(statusCodes.notFound), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Page not found',
      heading: statusCodes.notFound,
      message: 'Page not found',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.notFound)
  })

  test('Should provide expected "Forbidden" page', () => {
    catchAll(mockRequest(statusCodes.forbidden), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Forbidden',
      heading: statusCodes.forbidden,
      message: 'Forbidden',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.forbidden)
  })

  test('Should redirect to the session-expired page when the error is flagged sessionExpired', () => {
    const redirect = vi.fn().mockReturnValue('redirect-response')
    const request = {
      response: {
        isBoom: true,
        data: { sessionExpired: true },
        output: { statusCode: statusCodes.unauthorized }
      },
      logger: { error: mockErrorLogger }
    }

    const result = catchAll(request, { redirect })

    expect(redirect).toHaveBeenCalledWith('/auth/session-expired')
    expect(result).toBe('redirect-response')
    expect(mockToolkitView).not.toHaveBeenCalled()
  })

  test('Should provide expected "Unauthorized" page', () => {
    catchAll(mockRequest(statusCodes.unauthorized), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Unauthorized',
      heading: statusCodes.unauthorized,
      message: 'Unauthorized',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.unauthorized)
  })

  test('Should provide expected "Bad Request" page', () => {
    catchAll(mockRequest(statusCodes.badRequest), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Bad Request',
      heading: statusCodes.badRequest,
      message: 'Bad Request',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.badRequest)
  })

  test('Should provide a retry-friendly "Conflict" page for 409', () => {
    catchAll(mockRequest(statusCodes.conflict), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Another user is editing this. Please try again.',
      heading: statusCodes.conflict,
      message: 'Another user is editing this. Please try again.',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.conflict)
  })

  test('Should provide expected default page', () => {
    catchAll(mockRequest(statusCodes.imATeapot), mockToolkit)

    expect(mockErrorLogger).not.toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.imATeapot,
      message: 'Something went wrong',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(statusCodes.imATeapot)
  })

  test('Should provide expected "Something went wrong" page and log error for internalServerError', () => {
    catchAll(mockRequest(statusCodes.internalServerError), mockToolkit)

    expect(mockErrorLogger).toHaveBeenCalledWith(mockStack)
    expect(mockToolkitView).toHaveBeenCalledWith(errorPage, {
      pageTitle: 'Something went wrong',
      heading: statusCodes.internalServerError,
      message: 'Something went wrong',
      body: []
    })
    expect(mockToolkitCode).toHaveBeenCalledWith(
      statusCodes.internalServerError
    )
  })

  describe('when the backend was too busy to start the work', () => {
    const mockToolkitHeader = vi.fn()
    const toolkit = {
      view: vi.fn().mockReturnThis(),
      code: vi.fn().mockReturnThis(),
      header: mockToolkitHeader.mockReturnThis()
    }
    const busyRequest = (headers) => ({
      response: serviceBusyError(headers),
      logger: { error: mockErrorLogger }
    })

    test('shows "Sorry, the service is busy" with the wait, as a 503, and logs nothing', () => {
      catchAll(busyRequest({ 'retry-after': '5' }), toolkit)

      expect(toolkit.view).toHaveBeenCalledWith(errorPage, {
        pageTitle: 'Sorry, the service is busy',
        heading: statusCodes.serviceUnavailable,
        message: 'Sorry, the service is busy',
        body: [
          { before: 'The service is busy with other requests.' },
          { before: 'Wait 5 seconds, then try again.' }
        ]
      })
      expect(toolkit.code).toHaveBeenCalledWith(statusCodes.serviceUnavailable)
      expect(mockToolkitHeader).toHaveBeenCalledWith('Retry-After', '5')
      expect(mockErrorLogger).not.toHaveBeenCalled()
    })

    test('asks for a few minutes, and sends no Retry-After, when the backend gave no wait', () => {
      catchAll(busyRequest({}), toolkit)

      expect(toolkit.view).toHaveBeenCalledWith(
        errorPage,
        expect.objectContaining({
          body: [
            { before: 'The service is busy with other requests.' },
            { before: 'Wait a few minutes, then try again.' }
          ]
        })
      )
      expect(mockToolkitHeader).not.toHaveBeenCalled()
    })

    test('treats any other 503 as an error, and logs it', () => {
      catchAll(mockRequest(statusCodes.serviceUnavailable), mockToolkit)

      expect(mockErrorLogger).toHaveBeenCalledWith(mockStack)
      expect(mockToolkitView).toHaveBeenCalledWith(
        errorPage,
        expect.objectContaining({ pageTitle: 'Something went wrong' })
      )
    })
  })
})

describe('#serviceBusyPage', () => {
  test.each([
    [5, 'Wait 5 seconds, then try again.'],
    [1, 'Wait 1 second, then try again.'],
    [null, 'Wait a few minutes, then try again.']
  ])('for a wait of %s says "%s"', (seconds, line) => {
    expect(serviceBusyPage(seconds).body.at(-1)).toEqual({ before: line })
  })
})
