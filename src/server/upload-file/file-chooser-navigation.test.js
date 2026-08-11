import { initiateUpload } from '../common/services/uploader.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { getController as baselineController } from '../upload-baseline-file/controller.js'
import { getController as postInterventionController } from '../upload-post-intervention-file/controller.js'

vi.mock('../common/services/uploader.js')

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const RETURN_URL = `/projects/${PROJECT_ID}/baseline-habitat-list`
const SELECTION_HREF =
  `/projects/${PROJECT_ID}/upload-file?` +
  `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fbaseline-habitat-list`

function request(returnUrl = RETURN_URL) {
  return {
    params: { id: PROJECT_ID },
    query: { returnUrl },
    yar: {
      get: vi.fn(),
      set: vi.fn(),
      clear: vi.fn()
    }
  }
}

function responseToolkit() {
  const response = { header: vi.fn().mockReturnThis() }
  return {
    view: vi.fn().mockReturnValue(response)
  }
}

describe.each([
  ['baseline', baselineController],
  ['post-intervention', postInterventionController]
])('%s file chooser navigation', (_label, controller) => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: 200 },
      payload: { project: { name: 'Habitat project' } }
    })
    vi.mocked(initiateUpload).mockResolvedValue({
      uploadId: 'upload-id',
      uploadUrl: '/upload-and-scan/upload-id'
    })
  })

  test('Back and Cancel return to the upload selection page', async () => {
    const h = responseToolkit()

    await controller.handler(request(), h)

    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        backHref: SELECTION_HREF,
        cancelHref: SELECTION_HREF
      })
    )
  })

  test('an unsafe return URL falls back to the project task list', async () => {
    const h = responseToolkit()

    await controller.handler(request('https://example.com'), h)

    const encodedTaskList = `%2Fadd-project-details%2F${PROJECT_ID}`
    expect(h.view).toHaveBeenCalledWith(
      'habitat-upload-file/habitat-upload-file',
      expect.objectContaining({
        backHref: `/projects/${PROJECT_ID}/upload-file?returnUrl=${encodedTaskList}`,
        cancelHref: `/projects/${PROJECT_ID}/upload-file?returnUrl=${encodedTaskList}`
      })
    )
  })
})
