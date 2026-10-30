import Boom from '@hapi/boom'

import { backendSaveError, backendStatusOf } from './backend-save-error.js'

const featureId = 'aa0e8400-e29b-41d4-a716-446655440001'

describe('backendStatusOf', () => {
  test('reads the status wreck reports on the response', () => {
    expect(backendStatusOf({ data: { res: { statusCode: 422 } } })).toBe(422)
  })

  test('falls back to the Boom output', () => {
    expect(backendStatusOf(Boom.conflict())).toBe(409)
  })

  test('is undefined for an error with neither', () => {
    expect(backendStatusOf(new Error('socket hang up'))).toBeUndefined()
  })
})

describe('backendSaveError', () => {
  test('passes an expired session through untouched', () => {
    const expired = Boom.unauthorized('expired')
    expired.data = { sessionExpired: true }

    expect(backendSaveError(expired, featureId)).toBe(expired)
  })

  test.each([
    [Boom.conflict('locked'), 409, 'Another user is editing this project'],
    [Boom.notFound('gone'), 404, `Feature ${featureId} not found`],
    [Boom.badRequest('no'), 400, 'The habitat could not be saved'],
    [Boom.internal('down'), 502, 'Failed to save habitat'],
    [new Error('socket hang up'), 502, 'Failed to save habitat']
  ])('maps %s to %i', (err, statusCode, message) => {
    expect(backendSaveError(err, featureId)).toMatchObject({
      isBoom: true,
      output: { statusCode },
      message
    })
  })
})
