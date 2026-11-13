import Joi from 'joi'

import {
  WORDING,
  WORDING_STATUS,
  forbiddenWhenNone,
  logErrorTextWarnings,
  shownWordingField,
  wordingField,
  wordingStatus,
  wordsUnlessNone
} from './wording.js'

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }))
vi.mock('../helpers/logging/logger.js', () => ({
  createLogger: () => ({ warn: mockWarn })
}))

const field = Joi.object({ wording: wordingField })

const entry = Joi.object({
  wording: wordingField,
  text: wordsUnlessNone(Joi.string())
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
      const { error, warning } = field.validate({ wording })
      expect(error).toBeUndefined()
      expect(warning).toBeUndefined()
    }
  )

  test('warns of a value it does not know, and keeps it', () => {
    const { value, error, warning } = field.validate({ wording: 'interm' })
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

describe('shownWordingField', () => {
  const shown = Joi.object({ wording: shownWordingField })

  test('accepts interim wording', () => {
    expect(shown.validate({ wording: WORDING.INTERIM }).error).toBeUndefined()
  })

  test('refuses "none", as the words are shown all the same', () => {
    expect(shown.validate({ wording: WORDING.NONE }).error?.message).toBe(
      '"wording" contains an invalid value'
    )
  })

  test('warns of a value it does not know, rather than refusing it', () => {
    const { error, warning } = shown.validate({ wording: 'interm' })
    expect(error).toBeUndefined()
    expect(warning.details[0].type).toBe('wording.unrecognised')
  })
})

describe('forbiddenWhenNone', () => {
  const rule = Joi.object({
    wording: wordingField,
    text: forbiddenWhenNone(Joi.string())
  })

  test('refuses words on an entry with no wording yet', () => {
    expect(
      rule.validate({ wording: WORDING.NONE, text: 'Words' }).error?.message
    ).toBe('"text" is not allowed')
  })

  test.each([
    ['final', { text: 'Words' }],
    ['interim', { wording: WORDING.INTERIM, text: 'Words' }],
    ['absent', {}]
  ])('accepts words that are %s', (_, value) => {
    expect(rule.validate(value).error).toBeUndefined()
  })
})

describe('wordsUnlessNone', () => {
  test.each([
    ['final', {}],
    ['interim', { wording: WORDING.INTERIM }],
    // A slip for "none" still needs words: the page would have none to show.
    ['unknown', { wording: 'nnoe' }]
  ])('requires the words of %s wording', (_, value) => {
    expect(entry.validate(value).error?.message).toBe('"text" is required')
  })

  test('refuses words on an entry with no wording yet', () => {
    expect(
      entry.validate({ wording: WORDING.NONE, text: 'Words' }).error?.message
    ).toBe('"text" is not allowed')
  })

  test('does not require words for an entry with no wording yet', () => {
    expect(entry.validate({ wording: WORDING.NONE }).error).toBeUndefined()
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
      'error-text.yaml: pages.forbidden.wording is "tbc", which is neither "none" nor "interim", so it counts as unfinished. The page still shows the entry\'s words'
    )
  })

  test('logs nothing when there were no warnings', () => {
    logErrorTextWarnings(undefined)
    expect(mockWarn).not.toHaveBeenCalled()
  })
})
