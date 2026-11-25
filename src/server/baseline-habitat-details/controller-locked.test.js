import { load } from 'cheerio'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { primeCrumb } from '../common/test-helpers/csrf.js'
import { _resetReferenceCache } from './controller.js'

vi.mock('../common/helpers/wreck-client.js', () => ({
  wreck: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))

const authedAuth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const projectId = 'aa0e8400-e29b-41d4-a716-446655440000'
const areaId = 'aa0e8400-e29b-41d4-a716-446655440001'
const treeId = 'aa0e8400-e29b-41d4-a716-446655440003'
const hedgerowId = 'bb0e8400-e29b-41d4-a716-446655440012'
const watercourseId = 'cc0e8400-e29b-41d4-a716-446655440013'
const piFeatureId = 'dd0e8400-e29b-41d4-a716-446655440014'

const PROJECT_NAME = 'Greenfield Meadow Restoration'
const AREA_COMMENT = 'First line\nSecond line'
const COMMENT_HINT =
  'Add information to help the Local Planning Authority understand the baseline metric.'

const area = {
  featureId: areaId,
  ref: 'A1',
  type: 'Modified grassland',
  broadType: 'Grassland',
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  condition: 'Good',
  sizeSquareMetres: 25000,
  units: 15,
  comment: AREA_COMMENT
}
const tree = {
  featureId: treeId,
  ref: 'T1',
  type: 'Urban tree',
  broadType: 'Individual trees',
  treeSize: 'Medium',
  count: 2,
  distinctiveness: 'Medium',
  distinctivenessScore: 4,
  condition: 'Good',
  sizeSquareMetres: 326,
  units: 0.3912,
  comment: null
}
const hedgerow = {
  featureId: hedgerowId,
  ref: 'H1',
  type: 'Native hedgerow',
  distinctiveness: 'Low',
  distinctivenessScore: 2,
  condition: 'Good',
  sizeMetres: 1000,
  units: 4,
  comment: 'Hedge note'
}
const watercourse = {
  featureId: watercourseId,
  ref: 'W1',
  type: 'Ditches',
  distinctiveness: 'Medium',
  distinctivenessScore: 4,
  condition: 'Good',
  watercourseEncroachment: 'Minor',
  riparianEncroachment: 'Major/Major',
  sizeMetres: 500,
  units: 2,
  comment: '   '
}

const projectWithPostIntervention = {
  project: {
    name: PROJECT_NAME,
    baseline: {},
    postIntervention: { units: {} }
  }
}
const projectWithoutPostIntervention = {
  project: { name: PROJECT_NAME, baseline: {} }
}

const referencePayloads = [
  [
    '/reference/habitat-types-by-broad',
    {
      Grassland: [
        {
          name: 'Modified grassland',
          distinctiveness: 'Low',
          distinctivenessScore: 2
        }
      ],
      'Individual trees': [
        {
          name: 'Rural tree',
          distinctiveness: 'Medium',
          distinctivenessScore: 4
        },
        {
          name: 'Urban tree',
          distinctiveness: 'Medium',
          distinctivenessScore: 4
        }
      ]
    }
  ],
  [
    '/reference/trading-rules',
    {
      Low: 'Same distinctiveness or better habitat required ≥',
      Medium:
        'Same broad habitat or a higher distinctiveness habitat required (≥)'
    }
  ],
  [
    '/reference/hedgerow-types',
    [
      {
        name: 'Native hedgerow',
        distinctiveness: 'Low',
        distinctivenessScore: 2
      }
    ]
  ],
  [
    '/reference/watercourse-types',
    [{ name: 'Ditches', distinctiveness: 'Medium', distinctivenessScore: 4 }]
  ],
  [
    '/reference/watercourse-encroachments',
    {
      watercourse: ['No Encroachment', 'Minor', 'Major', 'N/A - Culvert'],
      riparian: [
        'No Encroachment',
        'Minor/Minor',
        'Major/Major',
        'N/A - Culvert'
      ]
    }
  ]
]

function serve(project) {
  const payloads = [
    [
      `/projects/${projectId}/features/${areaId}`,
      { type: 'habitat', feature: area }
    ],
    [
      `/projects/${projectId}/features/${treeId}`,
      { type: 'tree', feature: tree }
    ],
    [
      `/projects/${projectId}/features/${hedgerowId}`,
      { type: 'hedgerow', feature: hedgerow }
    ],
    [
      `/projects/${projectId}/features/${watercourseId}`,
      { type: 'watercourse', feature: watercourse }
    ],
    [`/projects/${projectId}`, project],
    ...referencePayloads
  ]
  vi.mocked(wreck.get).mockImplementation((u) => {
    if (u.includes('/reference/conditions')) {
      return Promise.resolve({
        res: { statusCode: statusCodes.ok },
        payload: [
          { condition: 'Good', score: 3 },
          { condition: 'Poor', score: 1 }
        ]
      })
    }
    // The watercourse trading rules are asked for with a query string.
    const path = u.split('?')[0]
    const match = payloads.find(([suffix]) => path.endsWith(suffix))
    return Promise.resolve(
      match
        ? { res: { statusCode: statusCodes.ok }, payload: match[1] }
        : { res: { statusCode: statusCodes.notFound }, payload: null }
    )
  })
}

/** The read-only value shown under a stacked field's label. */
function stackedValue($, label) {
  return $('.app-stacked-fields__item h3')
    .filter((_i, el) => $(el).text().trim() === label)
    .next('p')
    .text()
    .trim()
}

describe('#baselineHabitatDetails - locked once post-intervention data is uploaded (BMD-1194)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    _resetReferenceCache()
    serve(projectWithPostIntervention)
  })

  afterEach(() => {
    vi.mocked(wreck.get).mockReset()
  })

  const get = async (featureId) => {
    const { statusCode, result } = await server.inject({
      method: 'GET',
      url: `/baseline-habitat-details?featureId=${featureId}&projectId=${projectId}`,
      auth: authedAuth
    })
    expect(statusCode).toBe(statusCodes.ok)
    return load(result)
  }

  it.each([
    ['an area habitat', areaId],
    ['an individual tree', treeId],
    ['a hedgerow', hedgerowId],
    ['a watercourse', watercourseId]
  ])('offers nothing to edit or save on %s', async (_name, featureId) => {
    const $ = await get(featureId)

    expect($('form')).toHaveLength(0)
    expect($('input')).toHaveLength(0)
    expect($('select')).toHaveLength(0)
    expect($('textarea')).toHaveLength(0)
    expect($('#bhd-reference-data')).toHaveLength(0)
    expect(
      $('button').filter((_i, el) => $(el).text().trim() === 'Save')
    ).toHaveLength(0)
    expect($('body').text()).not.toContain(COMMENT_HINT)
  })

  it('shows an area habitat’s values as text under their labels', async () => {
    const $ = await get(areaId)

    expect($('h1').text()).toContain('Habitat A1')
    expect(stackedValue($, 'Habitat reference')).toBe('A1')
    expect(stackedValue($, 'Broad habitat')).toBe('Grassland')
    expect(stackedValue($, 'Habitat type')).toBe('Modified grassland')
    expect(stackedValue($, 'Condition')).toBe('Good (3)')
    expect(stackedValue($, 'Size (hectares)')).not.toBe('')
    expect(stackedValue($, 'Strategic significance')).toBe('Low (1)')
  })

  it('keeps Cancel, going back to the baseline list', async () => {
    const $ = await get(areaId)
    const cancel = $('a.govuk-link').filter(
      (_i, el) => $(el).text().trim() === 'Cancel'
    )

    expect(cancel.attr('href')).toBe(`/projects/${projectId}/area-baseline`)
  })

  it('shows the comment in full, with its line breaks, under Supporting information', async () => {
    const $ = await get(areaId)
    const heading = $('h2').filter(
      (_i, el) => $(el).text().trim() === 'Supporting information'
    )
    const comment = heading.next('p')

    expect(heading).toHaveLength(1)
    expect(comment.hasClass('app-stacked-fields__value--multiline')).toBe(true)
    expect(comment.text()).toBe(AREA_COMMENT)
  })

  it('shows "No data" when no comment is saved', async () => {
    const $ = await get(treeId)
    const heading = $('h2').filter(
      (_i, el) => $(el).text().trim() === 'Supporting information'
    )

    expect(heading.next('p').text()).toBe('No data')
  })

  it('shows "No data" for a whitespace-only comment', async () => {
    const $ = await get(watercourseId)
    const heading = $('h2').filter(
      (_i, el) => $(el).text().trim() === 'Supporting information'
    )

    expect(heading.next('p').text()).toBe('No data')
  })

  it('shows an individual tree’s fixed broad habitat and type as text', async () => {
    const $ = await get(treeId)

    expect(stackedValue($, 'Broad habitat')).toBe('Individual trees')
    expect(stackedValue($, 'Habitat type')).toBe('Urban tree')
    expect(stackedValue($, 'Tree size')).not.toBe('')
    expect(stackedValue($, 'Number of trees')).toBe('2')
  })

  it('shows a hedgerow’s values as text, without a broad habitat', async () => {
    const $ = await get(hedgerowId)

    expect(stackedValue($, 'Habitat reference')).toBe('H1')
    expect(stackedValue($, 'Habitat type')).toBe('Native hedgerow')
    expect(stackedValue($, 'Condition')).toBe('Good (3)')
    expect(stackedValue($, 'Broad habitat')).toBe('')
  })

  it('shows a watercourse’s encroachments as text', async () => {
    const $ = await get(watercourseId)

    expect(stackedValue($, 'Habitat type')).toBe('Ditches')
    expect(stackedValue($, 'Watercourse encroachment')).toBe('Minor')
    expect(stackedValue($, 'Riparian encroachment')).toBe('Major/Major')
  })

  it('stays editable when no post-intervention data is uploaded', async () => {
    serve(projectWithoutPostIntervention)
    const $ = await get(areaId)

    expect($('form#habitat-details-form')).toHaveLength(1)
    expect($('select#habitatType')).toHaveLength(1)
    expect($('textarea#comment')).toHaveLength(1)
    expect($('body').text()).toContain(COMMENT_HINT)
  })

  describe('saving', () => {
    let crumb

    beforeAll(async () => {
      crumb = await primeCrumb(server)
    })

    afterEach(() => {
      vi.mocked(wreck.put).mockReset()
    })

    const post = (payload) =>
      server.inject({
        method: 'POST',
        url: '/baseline-habitat-details',
        auth: authedAuth,
        headers: { cookie: crumb.cookie },
        payload: {
          projectId,
          featureId: areaId,
          habitatRef: 'A2',
          comment: 'Changed',
          crumb: crumb.token,
          ...payload
        }
      })

    it('saves nothing and shows the locked page', async () => {
      const { statusCode, result } = await post()
      const $ = load(result)

      expect(wreck.put).not.toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.ok)
      expect($('form')).toHaveLength(0)
      expect(stackedValue($, 'Habitat reference')).toBe('A1')
    })

    it('saves nothing, and shows no errors, when the submission would be refused', async () => {
      const { statusCode, result } = await post({ habitatRef: '' })
      const $ = load(result)

      expect(wreck.put).not.toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.ok)
      expect($('.govuk-error-summary')).toHaveLength(0)
    })

    it('keeps Back to the post-intervention page the form came from', async () => {
      const returnUrl = `/post-intervention-habitat-details?featureId=${piFeatureId}&projectId=${projectId}`
      const { result } = await post({ returnUrl })
      const $ = load(result)
      const cancel = $('a.govuk-link').filter(
        (_i, el) => $(el).text().trim() === 'Cancel'
      )

      expect(cancel.attr('href')).toBe(returnUrl)
    })

    it('refuses the save when the project cannot be fetched to check the lock', async () => {
      const routed = vi.mocked(wreck.get).getMockImplementation()
      vi.mocked(wreck.get).mockImplementation((u) =>
        u.endsWith(`/projects/${projectId}`)
          ? Promise.reject(new Error('backend down'))
          : routed(u)
      )
      const { statusCode } = await post()

      expect(wreck.put).not.toHaveBeenCalled()
      expect(statusCode).toBe(statusCodes.badGateway)
    })

    it('shows only stored values when the lock arrives while a refused submission is shown again', async () => {
      // Unlocked when the save checks, locked by the time the page is drawn.
      serve(projectWithoutPostIntervention)
      const routed = vi.mocked(wreck.get).getMockImplementation()
      let projectFetches = 0
      vi.mocked(wreck.get).mockImplementation((u) => {
        if (u.endsWith(`/projects/${projectId}`)) {
          projectFetches += 1
          const project =
            projectFetches === 1
              ? projectWithoutPostIntervention
              : projectWithPostIntervention
          return Promise.resolve({
            res: { statusCode: statusCodes.ok },
            payload: project
          })
        }
        return routed(u)
      })

      // A blank reference where one is saved is refused; the condition
      // chosen with it was never saved.
      const { result } = await post({ habitatRef: '', condition: 'Poor' })
      const $ = load(result)

      expect(wreck.put).not.toHaveBeenCalled()
      expect($('form')).toHaveLength(0)
      expect(stackedValue($, 'Condition')).toBe('Good (3)')
      expect(stackedValue($, 'Habitat reference')).toBe('A1')
    })

    it('still saves when no post-intervention data is uploaded', async () => {
      serve(projectWithoutPostIntervention)
      vi.mocked(wreck.put).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: { type: 'habitat' }
      })
      const { statusCode } = await post()

      expect(wreck.put).toHaveBeenCalledTimes(1)
      expect(statusCode).toBe(statusCodes.redirect)
    })

    it('is refused with 403 without a crumb', async () => {
      const { statusCode } = await server.inject({
        method: 'POST',
        url: '/baseline-habitat-details',
        auth: authedAuth,
        payload: { projectId, featureId: areaId }
      })

      expect(statusCode).toBe(statusCodes.forbidden)
      expect(wreck.put).not.toHaveBeenCalled()
    })
  })

  it('stays editable when the project cannot be fetched', async () => {
    const routed = vi.mocked(wreck.get).getMockImplementation()
    vi.mocked(wreck.get).mockImplementation((u) =>
      u.endsWith(`/projects/${projectId}`)
        ? Promise.reject(new Error('backend down'))
        : routed(u)
    )
    const $ = await get(areaId)

    expect($('form#habitat-details-form')).toHaveLength(1)
  })
})
