import process from 'node:process'

vi.mock('./server/common/helpers/start-server.js', () => ({
  startServer: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('./server/common/helpers/logging/logger.js', () => ({
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn()
  })
}))

describe('#index', () => {
  test('Should start the server', async () => {
    const { startServer } =
      await import('./server/common/helpers/start-server.js')

    await import('./index.js')

    expect(startServer).toHaveBeenCalled()
  })

  test('Should handle unhandled rejections', async () => {
    const { createLogger } =
      await import('./server/common/helpers/logging/logger.js')
    const mockLogger = createLogger()

    await import('./index.js')

    const error = new Error('test error')
    process.emit('unhandledRejection', error)

    expect(mockLogger.info).toHaveBeenCalledWith('Unhandled rejection')
    expect(mockLogger.error).toHaveBeenCalledWith(error)
    expect(process.exitCode).toBe(1)
  })
})
