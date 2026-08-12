import {
  defaultUploadReturnUrl,
  safeUploadReturnUrl,
  selectedUploadHref,
  uploadFileHref
} from './upload-file-navigation.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'

describe('upload file navigation', () => {
  test('defaults to the project task list', () => {
    expect(defaultUploadReturnUrl(PROJECT_ID)).toBe(
      `/add-project-details/${PROJECT_ID}`
    )
    expect(safeUploadReturnUrl(undefined, PROJECT_ID)).toBe(
      `/add-project-details/${PROJECT_ID}`
    )
  })

  test.each([
    'https://example.com',
    '//example.com/path',
    String.raw`\example.com`,
    ''
  ])('rejects unsafe return URL %j', (returnUrl) => {
    expect(safeUploadReturnUrl(returnUrl, PROJECT_ID)).toBe(
      `/add-project-details/${PROJECT_ID}`
    )
  })

  test('retains an internal return URL', () => {
    expect(
      safeUploadReturnUrl(
        `/projects/${PROJECT_ID}/baseline-habitat-list`,
        PROJECT_ID
      )
    ).toBe(`/projects/${PROJECT_ID}/baseline-habitat-list`)
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
        `/add-project-details/${PROJECT_ID}`
      )
    ).toBe(
      `/projects/${PROJECT_ID}/upload-baseline-file?returnUrl=%2Fadd-project-details%2F${PROJECT_ID}`
    )
  })
})
