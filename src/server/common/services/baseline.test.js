import { vi } from 'vitest'
import Wreck from '@hapi/wreck'

import { validateBaseline } from './baseline.js'

const uploadId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

describe('#validateBaseline', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('Should return valid:true when backend reports file is valid', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: { valid: true }
    })

    const result = await validateBaseline(uploadId)

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
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: { valid: false, errors }
    })

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should default to an empty errors array when payload omits one', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: { valid: false }
    })

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({ valid: false, errors: [] })
  })

  test('Should forward structured errors from a 4xx response', async () => {
    const errors = [{ code: 'UPLOAD_NOT_READY', message: 'not ready' }]
    const boomError = {
      output: { statusCode: 409 },
      data: { payload: { valid: false, errors } }
    }
    vi.spyOn(Wreck, 'post').mockRejectedValue(boomError)

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({ valid: false, errors })
  })

  test('Should fall back to a single error when 4xx has no errors array', async () => {
    const boomError = {
      output: { statusCode: 400 },
      data: { payload: { error: 'Bad input' } }
    }
    vi.spyOn(Wreck, 'post').mockRejectedValue(boomError)

    const result = await validateBaseline(uploadId)

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
    vi.spyOn(Wreck, 'post').mockRejectedValue(boomError)

    await expect(validateBaseline(uploadId)).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should throw a Boom badGateway error on network failure', async () => {
    vi.spyOn(Wreck, 'post').mockRejectedValue(new Error('Network failure'))

    await expect(validateBaseline(uploadId)).rejects.toMatchObject({
      isBoom: true,
      output: { statusCode: 502 }
    })
  })

  test('Should call the correct backend URL', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: { valid: true }
    })

    await validateBaseline(uploadId)

    expect(Wreck.post).toHaveBeenCalledWith(
      expect.stringContaining(`/baseline/validate/${uploadId}`),
      expect.objectContaining({ json: true })
    )
  })
})
