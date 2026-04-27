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

  test('Should return valid:false with error message when backend reports invalid file', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: {
        valid: false,
        errors: ['File is not a valid SQLite database']
      }
    })

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({
      valid: false,
      error: 'File is not a valid SQLite database'
    })
  })

  test('Should join multiple errors into a single string', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: {
        valid: false,
        errors: ['Missing required table', 'Invalid schema version']
      }
    })

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({
      valid: false,
      error: 'Missing required table, Invalid schema version'
    })
  })

  test('Should return fallback error message when invalid and no errors array', async () => {
    vi.spyOn(Wreck, 'post').mockResolvedValue({
      payload: { valid: false }
    })

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({
      valid: false,
      error: 'Unable to validate file'
    })
  })

  test('Should return valid:false with error message on 4xx response from backend', async () => {
    const boomError = {
      output: { statusCode: 422 },
      data: { payload: { error: 'Unprocessable file content' } }
    }
    vi.spyOn(Wreck, 'post').mockRejectedValue(boomError)

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({
      valid: false,
      error: 'Unprocessable file content'
    })
  })

  test('Should use fallback error message when 4xx response has no error field', async () => {
    const boomError = {
      output: { statusCode: 400 },
      data: { payload: {} }
    }
    vi.spyOn(Wreck, 'post').mockRejectedValue(boomError)

    const result = await validateBaseline(uploadId)

    expect(result).toEqual({
      valid: false,
      error: 'Unable to validate file'
    })
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
