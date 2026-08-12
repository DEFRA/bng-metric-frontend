import { fetchProject } from '../common/services/projects.js'
import {
  BASELINE_REQUIRED_ERROR,
  FILE_TYPES,
  SELECT_FILE_TYPE_ERROR,
  getController,
  postController
} from './controller.js'

vi.mock('../common/services/projects.js', () => ({
  fetchProject: vi.fn()
}))

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const TASK_LIST = `/add-project-details/${PROJECT_ID}`

function request({
  uploadType,
  returnUrl = TASK_LIST,
  queryReturnUrl = returnUrl
} = {}) {
  return {
    params: { id: PROJECT_ID },
    query: { returnUrl: queryReturnUrl },
    payload: { uploadType, returnUrl }
  }
}

function responseToolkit() {
  return {
    view: vi.fn((template, context) => ({ template, context })),
    redirect: vi.fn((location) => ({ location }))
  }
}

function mockProject(project = {}) {
  vi.mocked(fetchProject).mockResolvedValue({
    statusCode: 200,
    payload: { project: { name: 'Habitat project', ...project } }
  })
}

describe('upload file controller', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProject()
  })

  test('renders the page content and return navigation', async () => {
    const h = responseToolkit()

    await getController.handler(request(), h)

    expect(fetchProject).toHaveBeenCalledWith(expect.any(Object), PROJECT_ID)
    expect(h.view).toHaveBeenCalledWith('upload-file/index', {
      pageTitle: 'What would you like to upload?',
      heading: 'What would you like to upload?',
      caption: 'Habitat project',
      projectId: PROJECT_ID,
      returnUrl: TASK_LIST,
      backHref: TASK_LIST,
      cancelHref: TASK_LIST,
      items: [
        {
          value: FILE_TYPES.baseline.value,
          text: FILE_TYPES.baseline.text,
          checked: false
        },
        {
          value: FILE_TYPES.postIntervention.value,
          text: FILE_TYPES.postIntervention.text,
          checked: false
        }
      ],
      error: undefined
    })
  })

  test('uses the task list instead of an external return URL', async () => {
    const h = responseToolkit()

    await getController.handler(
      request({ queryReturnUrl: 'https://example.com' }),
      h
    )

    expect(h.view).toHaveBeenCalledWith(
      'upload-file/index',
      expect.objectContaining({
        backHref: TASK_LIST,
        cancelHref: TASK_LIST,
        returnUrl: TASK_LIST
      })
    )
  })

  test('redirects a baseline selection to the baseline file chooser', async () => {
    const h = responseToolkit()

    await postController.handler(
      request({ uploadType: FILE_TYPES.baseline.value }),
      h
    )

    expect(h.redirect).toHaveBeenCalledWith(
      `/projects/${PROJECT_ID}/upload-baseline-file?returnUrl=%2Fadd-project-details%2F${PROJECT_ID}`
    )
  })

  test.each([
    [{ baseline: { uploadId: 'baseline' } }, 'without existing PI'],
    [
      {
        baseline: { uploadId: 'baseline' },
        postIntervention: { uploadId: 'pi' }
      },
      'with existing PI'
    ]
  ])(
    'redirects a post-intervention selection when baseline exists %s',
    async (project) => {
      mockProject(project)
      const h = responseToolkit()

      await postController.handler(
        request({ uploadType: FILE_TYPES.postIntervention.value }),
        h
      )

      expect(h.redirect).toHaveBeenCalledWith(
        `/projects/${PROJECT_ID}/upload-post-intervention-file?returnUrl=%2Fadd-project-details%2F${PROJECT_ID}`
      )
    }
  )

  test('shows an error and retains the PI selection when baseline is absent', async () => {
    const h = responseToolkit()

    await postController.handler(
      request({ uploadType: FILE_TYPES.postIntervention.value }),
      h
    )

    expect(h.redirect).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'upload-file/index',
      expect.objectContaining({
        pageTitle: 'Error: What would you like to upload?',
        error: BASELINE_REQUIRED_ERROR,
        items: expect.arrayContaining([
          expect.objectContaining({
            value: FILE_TYPES.postIntervention.value,
            checked: true
          })
        ])
      })
    )
  })

  test('shows an error when no file type is selected', async () => {
    const h = responseToolkit()

    await postController.handler(request(), h)

    expect(h.redirect).not.toHaveBeenCalled()
    expect(h.view).toHaveBeenCalledWith(
      'upload-file/index',
      expect.objectContaining({
        pageTitle: 'Error: What would you like to upload?',
        error: SELECT_FILE_TYPE_ERROR
      })
    )
  })

  test.each([
    [null, 502],
    [{ statusCode: 404, payload: null }, 404],
    [{ statusCode: 500, payload: null }, 502]
  ])(
    'returns an appropriate error for project response %#',
    async (result, statusCode) => {
      vi.mocked(fetchProject).mockResolvedValue(result)

      await expect(
        getController.handler(request(), responseToolkit())
      ).rejects.toMatchObject({
        output: { statusCode }
      })
    }
  )
})
