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
// Exactly the limit once the browser's CRLF line break is put back to LF.
const EXACT_LIMIT_WITH_BREAK = `${'a'.repeat(MAX_COMMENT_LENGTH - 2)}\r\na`
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
    ['999 emoji, each one character', EMOJI_LIMIT],
    [
      '999 characters whose line break was submitted as CRLF',
      EXACT_LIMIT_WITH_BREAK
    ]
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

  test('puts a submitted CRLF or CR line break back to LF', () => {
    expect(cleanComment('one\r\ntwo\rthree\nfour')).toBe(
      'one\ntwo\nthree\nfour'
    )
  })

  test('keeps blank lines within the comment', () => {
    expect(cleanComment(' one\r\n\r\ntwo ')).toBe('one\n\ntwo')
  })
})

describe('commentFormFields', () => {
  test('shows the saved comment when nothing was submitted', () => {
    expect(commentFormFields({ savedComment: 'A note', refusals: [] })).toEqual(
      {
        commentErrors: [],
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

  test('lists every failed rule in the summary and against the field', () => {
    const fields = commentFormFields({
      submittedComment: OVER_LIMIT,
      refusals: [COMMENT_INVALID_CHARACTERS_ERROR, COMMENT_TOO_LONG_ERROR]
    })
    expect(fields.commentErrors).toEqual([
      { text: COMMENT_INVALID_CHARACTERS_ERROR.summary, href: '#comment' },
      { text: COMMENT_TOO_LONG_ERROR.summary, href: '#comment' }
    ])
    expect(fields.commentInput.error).toEqual({
      html: `${COMMENT_INVALID_CHARACTERS_ERROR.inline}<br>${COMMENT_TOO_LONG_ERROR.inline}`
    })
  })

  // The details page composes both from the reference's and the comment's,
  // so a field that returned either would overwrite the other's.
  test('returns neither a page title nor an errors key of its own', () => {
    const fields = commentFormFields({
      submittedComment: OVER_LIMIT,
      refusals: [COMMENT_TOO_LONG_ERROR]
    })
    expect(fields.pageTitle).toBeUndefined()
    expect(fields.errors).toBeUndefined()
  })

  test('words both messages from error-text.yaml', () => {
    expect(COMMENT_TOO_LONG_ERROR.inline).toContain(`${MAX_COMMENT_LENGTH}`)
    expect(COMMENT_INVALID_CHARACTERS_ERROR.summary).not.toBe(
      COMMENT_INVALID_CHARACTERS_ERROR.inline
    )
  })
})
