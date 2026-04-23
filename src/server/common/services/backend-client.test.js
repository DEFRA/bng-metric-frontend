import Wreck from '@hapi/wreck'

import { backendClient } from './backend-client.js'

vi.mock('@hapi/wreck', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ payload: {} }),
    post: vi.fn().mockResolvedValue({ payload: {} }),
    put: vi.fn().mockResolvedValue({ payload: {} }),
    delete: vi.fn().mockResolvedValue({ payload: {} })
  }
}))

function fakeRequest({ sub = 'user-123', yarId = 'yar-abc' } = {}) {
  return {
    auth: { credentials: { sub } },
    yar: { id: yarId }
  }
}

describe('#backendClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('Should send x-user-context on GET when request has session credentials', async () => {
    await backendClient(fakeRequest()).get('/projects/abc')

    expect(Wreck.get).toHaveBeenCalledOnce()
    const [url, opts] = Wreck.get.mock.calls[0]
    expect(url).toContain('/projects/abc')
    expect(opts.headers['x-user-context']).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })

  test('Should send x-user-context on POST', async () => {
    await backendClient(fakeRequest()).post('/projects/new', { json: true })

    expect(Wreck.post).toHaveBeenCalledOnce()
    const [, opts] = Wreck.post.mock.calls[0]
    expect(opts.headers['x-user-context']).toBeDefined()
    expect(opts.json).toBe(true)
  })

  test('Should preserve caller-provided headers and add the signed header alongside', async () => {
    await backendClient(fakeRequest()).post('/x', {
      headers: { 'Content-Type': 'application/json' }
    })

    const [, opts] = Wreck.post.mock.calls[0]
    expect(opts.headers['Content-Type']).toBe('application/json')
    expect(opts.headers['x-user-context']).toBeDefined()
  })

  test('Should omit the header when there is no authenticated user', async () => {
    await backendClient({ auth: {}, yar: {} }).get('/x')

    const [, opts] = Wreck.get.mock.calls[0]
    expect(opts.headers?.['x-user-context']).toBeUndefined()
  })

  test('Should pass through absolute URLs unchanged', async () => {
    await backendClient(fakeRequest()).get('https://example.test/whatever')

    const [url] = Wreck.get.mock.calls[0]
    expect(url).toBe('https://example.test/whatever')
  })
})
