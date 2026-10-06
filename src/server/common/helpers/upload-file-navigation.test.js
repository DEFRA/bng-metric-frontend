import {
  defaultUploadReturnUrl,
  safeUploadReturnUrl,
  selectedUploadHref,
  uploadFileHref
} from './upload-file-navigation.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('upload file navigation', () => {
  test('defaults to the project summary', () => {
    expect(defaultUploadReturnUrl(PROJECT_ID)).toBe(
      `/projects/${PROJECT_ID}/project-summary`
    )
    expect(safeUploadReturnUrl(undefined, PROJECT_ID)).toBe(
      `/projects/${PROJECT_ID}/project-summary`
    )
  })

  test.each([
    'https://example.com',
    '//example.com/path',
    String.raw`\example.com`,
    '/\t/evil.example',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\u0000/evil.example',
    ''
  ])('rejects unsafe return URL %j', (returnUrl) => {
    expect(safeUploadReturnUrl(returnUrl, PROJECT_ID)).toBe(
      `/projects/${PROJECT_ID}/project-summary`
    )
  })

  test('retains an internal return URL', () => {
    expect(
      safeUploadReturnUrl(`/projects/${PROJECT_ID}/area-baseline`, PROJECT_ID)
    ).toBe(`/projects/${PROJECT_ID}/area-baseline`)
  })

  test('builds the selection-page URL with an encoded return URL', () => {
    expect(uploadFileHref(PROJECT_ID, '/origin?tab=habitats')).toBe(
      `/projects/${PROJECT_ID}/upload-file?returnUrl=%2Forigin%3Ftab%3Dhabitats`
    )
  })

  test('builds the selected upload URL with an encoded return URL', () => {
    expect(
      selectedUploadHref(
        PROJECT_ID,
        'upload-baseline-file',
        `/projects/${PROJECT_ID}/project-summary`
      )
    ).toBe(
      `/projects/${PROJECT_ID}/upload-baseline-file?returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fproject-summary`
    )
  })
})
