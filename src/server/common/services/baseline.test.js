import { vi } from 'vitest'

import { validateBaseline, validatePostIntervention } from './baseline.js'
import { wreck } from '../helpers/wreck-client.js'

vi.mock('../helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const projectId = '11111111-2222-3333-4444-555555555555'
const uploadId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

// backendRequest reads the id_token from the yar session and forwards it as a
// Bearer header, so the validation calls now take a request as first arg.
function makeRequest(idToken = 'test-id-token') {
  return { yar: { get: vi.fn().mockReturnValue({ idToken }) } }
}

describe('#validateBaseline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should return valid:true when backend reports file is valid', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: true })
  })

  test('Should forward the structured error array when invalid', async () => {
    const errors = [
      { code: 'NO_HABITAT_AREAS', ac: 'AC3', message: 'No habitat areas' },
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        ac: 'AC8',
        message: 'Areas outside redline',
        offendingFeatures: [{ id: 1 }]
      }
    ]
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: false, errors }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should default to an empty errors array when payload omits one', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: false }
    })

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors: [] })
  })

  test('Should forward structured errors from a 4xx response', async () => {
    const errors = [{ code: 'UPLOAD_NOT_READY', message: 'not ready' }]
    const boomError = {
      output: { statusCode: 409 },
      data: { payload: { valid: false, errors } }
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should fall back to a single error when 4xx has no errors array', async () => {
    const boomError = {
      output: { statusCode: 400 },
      data: { payload: { error: 'Bad input' } }
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    const result = await validateBaseline(makeRequest(), projectId, uploadId)

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      { code: 'VALIDATION_FAILED', message: 'Bad input' }
    ])
  })

  test('Should throw a Boom badGateway error on 5xx response from backend', async () => {
    const boomError = {
      output: { statusCode: 503 },
      data: { payload: {} },
      message: 'Service Unavailable'
    }
    vi.mocked(wreck.post).mockRejectedValue(boomError)

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should throw a Boom badGateway error on network failure', async () => {
    vi.mocked(wreck.post).mockRejectedValue(new Error('Network failure'))

    await expect(
      validateBaseline(makeRequest(), projectId, uploadId)
    ).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should call the correct backend URL', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    await validateBaseline(makeRequest(), projectId, uploadId)

    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining(`/baseline/validate/${uploadId}`),
      expect.any(Object)
    )
  })

  test('Should send the projectId in the JSON request body so the backend can persist against the project', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    await validateBaseline(makeRequest(), projectId, uploadId)

    expect(wreck.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        payload: JSON.stringify({ projectId }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })
})

describe('#validatePostIntervention', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should call the post-intervention backend validation URL', async () => {
    vi.mocked(wreck.post).mockResolvedValue({
      payload: { valid: true }
    })

    const result = await validatePostIntervention(
      makeRequest(),
      projectId,
      uploadId
    )

    expect(result).toEqual({ valid: true })
    expect(wreck.post).toHaveBeenCalledWith(
      expect.stringContaining(`/post-intervention/validate/${uploadId}`),
      expect.objectContaining({
        payload: JSON.stringify({ projectId }),
        headers: expect.objectContaining({
          'Content-Type': 'application/json'
        })
      })
    )
  })
})
