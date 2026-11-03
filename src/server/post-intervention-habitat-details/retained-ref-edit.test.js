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
    expect(retainedRefEditFields(base)).toEqual({
      heading: 'Hedgerow H1',
      pageTitle: 'Hedgerow H1',
      errors: [],
      habitatRefInput: {
        id: 'habitatRef',
        value: 'H1',
        error: undefined,
        maxLength: 100
      },
      refForm: {
        action: '/post-intervention-habitat-details',
        projectId,
        featureId,
        returnUrl: '',
        cancelHref: '/back'
      }
    })
  })

  test('keeps the saved reference in the heading when a typed one is refused', () => {
    expect(
      retainedRefEditFields({
        ...base,
        submittedRef: '  ',
        returnUrl: '/r',
        refusal: { summary: 'Summary.', inline: 'Inline.' }
      })
    ).toMatchObject({
      heading: 'Hedgerow H1',
      pageTitle: 'Error: Hedgerow H1',
      errors: [{ text: 'Summary.', href: '#habitatRef' }],
      habitatRefInput: { value: '  ', error: { text: 'Inline.' } },
      refForm: { returnUrl: '/r' }
    })
  })

  test('copes with a habitat that has no reference', () => {
    expect(
      retainedRefEditFields({ ...base, type: 'habitat', feature: {} })
    ).toMatchObject({ heading: 'Habitat', habitatRefInput: { value: '' } })
  })
})

describe('saveRetainedRef', () => {
  afterEach(() => {
    vi.mocked(backendRequest).mockReset()
  })

  test('says the reference is in use when the backend refuses it as such', async () => {
    vi.mocked(backendRequest).mockRejectedValue({
      data: {
        res: { statusCode: 422 },
        payload: { code: 'HABITAT_REF_IN_USE' }
      }
    })

    await expect(
      saveRetainedRef({}, { projectId, featureId, ref: 'A2' })
    ).resolves.toEqual({ refInUse: true })
  })

  test('passes an expired session through untouched', async () => {
    const expired = Boom.unauthorized('expired')
    expired.data = { sessionExpired: true }
    vi.mocked(backendRequest).mockRejectedValue(expired)

    await expect(
      saveRetainedRef({}, { projectId, featureId, ref: 'P-1' })
    ).rejects.toBe(expired)
  })

  test('maps any other refusal through backendSaveError', async () => {
    const error = new Error('Response Error: 409 Conflict')
    error.data = { res: { statusCode: 409 } }
    vi.mocked(backendRequest).mockRejectedValue(error)

    await expect(
      saveRetainedRef({}, { projectId, featureId, ref: 'P-1' })
    ).rejects.toMatchObject({ output: { statusCode: 409 } })
  })
})
