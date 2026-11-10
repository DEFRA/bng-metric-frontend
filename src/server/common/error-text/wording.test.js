import Joi from 'joi'

import {
  WORDING,
  WORDING_STATUS,
  logErrorTextWarnings,
  requiredWhenWorded,
  wordingField,
  wordingStatus
} from './wording.js'

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))
vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn })
}))

const entry = Joi.object({
  wording: wordingField,
  text: requiredWhenWorded(Joi.string())
})

describe('wordingStatus', () => {
  test.each([
    ['words alone', 'Enter a project name', WORDING_STATUS.FINAL],
    ['an entry with no wording field', { text: 'Done' }, WORDING_STATUS.FINAL],
    ['interim wording', { wording: WORDING.INTERIM }, WORDING_STATUS.INTERIM],
    ['no wording yet', { wording: WORDING.NONE }, WORDING_STATUS.NONE],
    ['a value it does not know', { wording: 'interm' }, WORDING_STATUS.NONE],
    ['no entry', undefined, WORDING_STATUS.FINAL],
    ['null', null, WORDING_STATUS.FINAL]
  ])('reads %s', (_, value, status) => {
    expect(wordingStatus(value)).toBe(status)
  })
})

describe('wordingField', () => {
  test.each([[WORDING.NONE], [WORDING.INTERIM]])(
    'accepts "%s" without a warning',
    (wording) => {
      const { error, warning } = entry.validate({ wording, text: 'Words' })
      expect(error).toBeUndefined()
      expect(warning).toBeUndefined()
    }
  )

  test('warns of a value it does not know, and keeps it', () => {
    const { value, error, warning } = entry.validate({ wording: 'interm' })
    expect(error).toBeUndefined()
    expect(value.wording).toBe('interm')
    expect(warning.details).toEqual([
      expect.objectContaining({
        path: ['wording'],
        type: 'wording.unrecognised',
        context: expect.objectContaining({ value: 'interm' })
      })
    ])
  })
})

describe('requiredWhenWorded', () => {
  test.each([
    ['final', {}],
    ['interim', { wording: WORDING.INTERIM }]
  ])('requires the words of %s wording', (_, value) => {
    expect(entry.validate(value).error?.message).toBe('"text" is required')
  })

  test.each([
    ['no wording yet', { wording: WORDING.NONE }],
    ['a value it does not know', { wording: 'interm' }]
  ])('does not require words for %s', (_, value) => {
    expect(entry.validate(value).error).toBeUndefined()
  })
})

describe('logErrorTextWarnings', () => {
  beforeEach(() => {
    mockWarn.mockClear()
  })

  test("logs each warning with the entry's place in the file", () => {
    const { warning } = Joi.object({ forbidden: entry }).validate({
      forbidden: { wording: 'tbc', text: 'Forbidden' }
    })
    logErrorTextWarnings(warning, 'pages')
    expect(mockWarn).toHaveBeenCalledWith(
      'error-text.yaml: pages.forbidden.wording is "tbc", which is neither "none" nor "interim", so it is read as "none"'
    )
  })

  test('logs nothing when there were no warnings', () => {
    logErrorTextWarnings(undefined)
    expect(mockWarn).not.toHaveBeenCalled()
  })
})
