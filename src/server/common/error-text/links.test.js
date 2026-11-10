import { splitLink } from './links.js'
import { fillErrorText } from './error-text.js'

describe('splitLink', () => {
  test('splits a sentence at its link', () => {
    expect(splitLink('Draw it again and [upload a new file](upload).')).toEqual(
      {
        before: 'Draw it again and ',
        linkText: 'upload a new file',
        target: 'upload',
        after: '.'
      }
    )
  })

  test('gives a sentence with no link whole', () => {
    expect(splitLink('No link here')).toEqual({ before: 'No link here' })
  })

  test('leaves a value that looks like a link as text when split first', () => {
    const { before } = splitLink('Parcel {ref} has an error')
    expect(fillErrorText(before, { ref: '[x](home)' })).toBe(
      'Parcel [x](home) has an error'
    )
  })
})
