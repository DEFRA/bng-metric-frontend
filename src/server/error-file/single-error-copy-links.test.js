import { resolveSingleErrorCopy } from './single-error-copy.js'

// No upload wording puts a value from the file before a link, so this gives
// the page a code that does, to show a value holding link syntax stays text.
const CODE = 'TEST_REF_BEFORE_LINK'

vi.mock('./dropout-copy.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    singleProblemPages: (error) =>
      error?.code === CODE
        ? {
            title: 'This parcel {ref} contains an error',
            body: 'Parcel {ref} overlaps itself. Draw it again and [upload a new file](upload).'
          }
        : original.singleProblemPages(error)
  }
})

const UPLOAD_HREF = '/projects/proj-1/upload-baseline-file'

describe('#resolveSingleErrorCopy with link syntax in a value', () => {
  test.each([['[x](upload)'], ['a](upload) b'], ['[unclosed']])(
    'keeps a habitat ref of %s as text, and the link where it was',
    (ref) => {
      const result = resolveSingleErrorCopy(
        { code: CODE, details: { sample: [{ feature_ref: ref }] } },
        UPLOAD_HREF
      )

      expect(result).toMatchObject({
        variant: 'standard',
        messageBefore: `Parcel ${ref} overlaps itself. Draw it again and `,
        linkText: 'upload a new file',
        messageAfter: '.',
        uploadHref: UPLOAD_HREF
      })
    }
  )
})
