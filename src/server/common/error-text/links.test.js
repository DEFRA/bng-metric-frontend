import { splitLink } from './links.js'
import { fillPage } from './error-text.js'

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
})

describe('fillPage, as pageErrorText fills a page', () => {
  const page = {
    title: 'Problem with {ref}',
    body: ['Habitat {ref} has an error. [Return to the home page](home).']
  }

  test.each([['[x](home)'], ['a](home) b'], ['[unclosed']])(
    'keeps a value holding link syntax, %s, as text, and the link where it was',
    (ref) => {
      expect(fillPage(page, { ref })).toEqual({
        title: `Problem with ${ref}`,
        body: [
          {
            before: `Habitat ${ref} has an error. `,
            link: { text: 'Return to the home page', href: '/' },
            after: '.'
          }
        ]
      })
    }
  )
})
