import { describe, expect, test } from 'vitest'

import {
  COMMENT_INVALID_CHARACTERS_ERROR,
  COMMENT_TOO_LONG_ERROR,
  MAX_COMMENT_LENGTH,
  cleanComment,
  commentFormFields,
  commentRefusals
} from './habitat-comment.js'

const EXACT_LIMIT = 'a'.repeat(MAX_COMMENT_LENGTH)
const OVER_LIMIT = 'a'.repeat(MAX_COMMENT_LENGTH + 1)
const EMOJI_LIMIT = '🌳'.repeat(MAX_COMMENT_LENGTH)

describe('commentRefusals', () => {
  test.each([
    ['an empty value', ''],
    ['whitespace only', ' \n\t '],
    ['a missing value', undefined],
    ['a null value', null],
    ['a comment of exactly 999 characters', EXACT_LIMIT],
    ['a 999-character comment padded with whitespace', `  ${EXACT_LIMIT}  `],
    ['999 emoji, each one character', EMOJI_LIMIT]
  ])('accepts %s', (_label, value) => {
    expect(commentRefusals(value)).toEqual([])
  })

  test('refuses 1000 characters after trimming', () => {
    expect(commentRefusals(`\n${OVER_LIMIT} `)).toEqual([
      COMMENT_TOO_LONG_ERROR
    ])
  })

  test('counts an emoji as one character', () => {
    expect(commentRefusals(`${EMOJI_LIMIT}🌳`)).toEqual([
      COMMENT_TOO_LONG_ERROR
    ])
  })

  test.each([
    ['a replacement character', 'note \uFFFD'],
    ['a lone surrogate', 'note \uD800']
  ])('refuses %s', (_label, value) => {
    expect(commentRefusals(value)).toEqual([COMMENT_INVALID_CHARACTERS_ERROR])
  })

  test('names both rules when a comment breaks both, characters first', () => {
    expect(commentRefusals(`\uFFFD${OVER_LIMIT}`)).toEqual([
      COMMENT_INVALID_CHARACTERS_ERROR,
      COMMENT_TOO_LONG_ERROR
    ])
  })
})

describe('cleanComment', () => {
  test('trims and keeps a blank as an empty string', () => {
    expect(cleanComment('  kept  note  ')).toBe('kept  note')
    expect(cleanComment(' \n ')).toBe('')
    expect(cleanComment(null)).toBe('')
  })
})

describe('commentFormFields', () => {
  test('shows the saved comment when nothing was submitted', () => {
    expect(commentFormFields({ savedComment: 'A note', refusals: [] })).toEqual(
      {
        errors: [],
        commentInput: { id: 'comment', value: 'A note', error: undefined }
      }
    )
  })

  test('shows an empty box when no comment is stored', () => {
    expect(commentFormFields({ savedComment: null }).commentInput.value).toBe(
      ''
    )
  })

  test('keeps what was typed ahead of the saved comment', () => {
    expect(
      commentFormFields({
        savedComment: 'saved',
        submittedComment: 'typed',
        refusals: []
      }).commentInput.value
    ).toBe('typed')
  })

  test('lists every failed rule in the summary and the inline message', () => {
    const fields = commentFormFields({
      submittedComment: OVER_LIMIT,
      refusals: [COMMENT_INVALID_CHARACTERS_ERROR, COMMENT_TOO_LONG_ERROR]
    })
    expect(fields.errors).toEqual([
      { text: COMMENT_INVALID_CHARACTERS_ERROR.summary, href: '#comment' },
      { text: COMMENT_TOO_LONG_ERROR.summary, href: '#comment' }
    ])
    expect(fields.commentInput.error.html).toBe(
      `${COMMENT_INVALID_CHARACTERS_ERROR.inline}<br>${COMMENT_TOO_LONG_ERROR.inline}`
    )
    expect(fields.pageTitle).toBeUndefined()
  })
})
