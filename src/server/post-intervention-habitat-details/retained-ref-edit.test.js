import Boom from '@hapi/boom'

import { backendRequest } from '../common/helpers/auth/backend-request.js'
import {
  isRefEditable,
  retainedRefEditFields,
  saveRetainedRef
} from './retained-ref-edit.js'

vi.mock('../common/helpers/auth/backend-request.js', () => ({
  backendRequest: vi.fn()
}))

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const featureId = 'aa0e8400-e29b-41d4-a716-446655440001'

describe('isRefEditable', () => {
  test.each(['habitat', 'hedgerow', 'watercourse'])(
    'is true for a Retained %s',
    (type) => {
      expect(isRefEditable(type, 'Retained')).toBe(true)
    }
  )

  test.each([
    ['habitat', 'Created'],
    ['habitat', 'Enhanced'],
    ['habitat', null],
    ['tree', 'Retained']
  ])('is false for a %s that is %s', (type, retentionCategory) => {
    expect(isRefEditable(type, retentionCategory)).toBe(false)
  })
})

describe('retainedRefEditFields', () => {
  const base = {
    type: 'hedgerow',
    feature: { ref: 'H1' },
    projectId,
    featureId,
    cancelHref: '/back'
  }

  test('names the page by its saved reference, with no error', () => {
    expect(retainedRefEditFields(base)).toMatchObject({
      heading: 'Hedgerow H1',
      pageTitle: 'Hedgerow H1',
      errors: [],
      refForm: { value: 'H1', error: undefined, returnUrl: '' }
    })
  })

  test('keeps the saved reference in the heading when a typed one is refused', () => {
    expect(
      retainedRefEditFields({ ...base, submittedRef: '  ', returnUrl: '/r' })
    ).toMatchObject({
      heading: 'Hedgerow H1',
      pageTitle: 'Error: Hedgerow H1',
      errors: [
        {
          text: 'You have entered an invalid habitat reference.',
          href: '#ref'
        }
      ],
      refForm: {
        value: '  ',
        error: { text: 'Enter a valid habitat reference.' },
        returnUrl: '/r'
      }
    })
  })

  test('copes with a habitat that has no reference', () => {
    expect(
      retainedRefEditFields({ ...base, type: 'habitat', feature: {} })
    ).toMatchObject({ heading: 'Habitat', refForm: { value: '' } })
  })
})

describe('saveRetainedRef', () => {
  afterEach(() => {
    vi.mocked(backendRequest).mockReset()
  })

  test('passes an expired session through untouched', async () => {
    const expired = Boom.unauthorized('expired')
    expired.data = { sessionExpired: true }
    vi.mocked(backendRequest).mockRejectedValue(expired)

    await expect(
      saveRetainedRef({}, { projectId, featureId, ref: 'P-1' })
    ).rejects.toBe(expired)
  })

  test('reads the status of a backend error wreck reports on its response', async () => {
    const error = new Error('Response Error: 409 Conflict')
    error.data = { res: { statusCode: 409 } }
    vi.mocked(backendRequest).mockRejectedValue(error)

    await expect(
      saveRetainedRef({}, { projectId, featureId, ref: 'P-1' })
    ).rejects.toMatchObject({ output: { statusCode: 409 } })
  })
})
