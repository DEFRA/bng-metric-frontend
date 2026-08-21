import { createServer } from '../server.js'
import { load } from 'cheerio'
import { statusCodes } from '../common/constants.js'
import { wreck } from '../common/helpers/wreck-client.js'
import { formatUnits, percentageSummary } from './controller.js'

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
const auth = {
  strategy: 'session',
  credentials: {
    sub: 'test-user',
    email: 'test@example.com',
    roles: ['aaa-bbb:bng completer:3']
  }
}

const project = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      habitats: [{}],
      hedgerows: [{}],
      watercourses: [{}],
      units: {
        habitatsTotal: 1.23456789012345,
        treesTotal: 0.285,
        hedgerowsTotal: 4.5,
        watercoursesTotal: 3
      }
    }
  }
}

const projectWithPostIntervention = {
  project: {
    name: 'Riverbank restoration',
    baseline: {
      habitats: [{}],
      hedgerows: [{}],
      watercourses: [{}],
      units: {
        habitatsTotal: 8,
        treesTotal: 2,
        hedgerowsTotal: 4,
        watercoursesTotal: 10
      }
    },
    postIntervention: {
      habitats: [{}],
      hedgerows: [{}],
      watercourses: [{}],
      units: {
        habitatsTotal: 11,
        treesTotal: 5,
        hedgerowsTotal: 6,
        watercoursesTotal: 5,
        // The backend's habitats-prefixed net fields represent all area units,
        // including trees: (11 + 5) - (8 + 2) = 6, or 60%.
        habitatsNetUnitChange: 6,
        habitatsNetUnitChangePercentage: 60,
        hedgerowsNetUnitChange: 2,
        hedgerowsNetUnitChangePercentage: 50,
        watercoursesNetUnitChange: -5,
        watercoursesNetUnitChangePercentage: -50
      }
    }
  }
}

function removeHabitatTypes(upload, habitatTypes) {
  for (const habitatType of habitatTypes) {
    upload[habitatType] = []
    upload.units[`${habitatType}Total`] = 0
    const netUnitChange = `${habitatType}NetUnitChange`
    const netPercentageChange = `${habitatType}NetUnitChangePercentage`
    if (Object.hasOwn(upload.units, netUnitChange)) {
      upload.units[netUnitChange] = 0
      upload.units[netPercentageChange] = null
    }
  }
}

function projectWithoutHabitatTypes(
  habitatTypes,
  withPostIntervention,
  stripFrom = 'both'
) {
  const baseline = {
    habitats: [{}],
    hedgerows: [{}],
    watercourses: [{}],
    units: {
      habitatsTotal: 1,
      treesTotal: 0,
      hedgerowsTotal: 1,
      watercoursesTotal: 1
    }
  }
  if (stripFrom === 'baseline' || stripFrom === 'both') {
    removeHabitatTypes(baseline, habitatTypes)
  }

  const projectData = { name: 'Area project', baseline }

  if (withPostIntervention) {
    const postIntervention = {
      habitats: [{}],
      hedgerows: [{}],
      watercourses: [{}],
      units: {
        habitatsTotal: 2,
        treesTotal: 0,
        habitatsNetUnitChange: 1,
        habitatsNetUnitChangePercentage: 100,
        hedgerowsTotal: 2,
        hedgerowsNetUnitChange: 1,
        hedgerowsNetUnitChangePercentage: 100,
        watercoursesTotal: 2,
        watercoursesNetUnitChange: 1,
        watercoursesNetUnitChangePercentage: 100
      }
    }
    if (stripFrom === 'postIntervention' || stripFrom === 'both') {
      removeHabitatTypes(postIntervention, habitatTypes)
    }
    projectData.postIntervention = postIntervention
  }

  return { project: projectData }
}

describe('project summary', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: project
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  test('renders the baseline-only summary and project name', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Riverbank restoration')
    expect(result).toContain(
      'class="govuk-width-container app-width-container--wide"'
    )
    expect(result).toContain(
      'class="govuk-grid-row app-project-summary-layout"'
    )
    expect(result).toContain('class="app-grid-column-one-sixth"')
    expect(result).toContain('class="app-grid-column-five-sixths"')
    expect(result).toContain(
      '<h1 class="govuk-heading-xl govuk-!-margin-bottom-0">Summary</h1>'
    )
    expect(result).toContain('Area habitats')
    expect(result).toContain('Hedgerows')
    expect(result).toContain('Watercourses')
    expect(result.match(/Total on-site net percentage change/g)).toHaveLength(3)
    expect(result.match(/-100.00%/g)).toHaveLength(3)
    expect(result.match(/Not met/g)).toHaveLength(3)
    expect(result.match(/Trading Rules/g)).toHaveLength(3)
  })

  test('formats baseline, zero post-intervention and negative net units', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(result).toContain('1.52 units')
    expect(result).toContain('-1.52 units')
    expect(result).toContain('4.50 units')
    expect(result).toContain('-4.50 units')
    expect(result).toContain('3.00 units')
    expect(result).toContain('-3.00 units')
    expect(result.match(/0.00 units/g)).toHaveLength(3)
  })

  test('renders upload actions pointing to the new chooser with a summary return URL', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })
    const href =
      `/projects/${PROJECT_ID}/upload-file?` +
      `returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fproject-summary`

    expect(result.split(`href="${href}"`)).toHaveLength(5)
  })

  test('renders text-only navigation, trading rules, and project details', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    const $ = load(result)
    const navigation = $('nav[aria-label="Project summary"]')

    expect(navigation).toHaveLength(1)
    expect(navigation.find('li')).toHaveLength(4)
    expect(navigation.find('[aria-current="page"]').text()).toBe('Summary')
    expect(navigation.find('a')).toHaveLength(0)
    expect(navigation.text()).toContain('Area habitats')
    expect(navigation.text()).toContain('Hedgerows')
    expect(navigation.text()).toContain('Watercourses')
    expect(result).toContain('View trading rules')
    expect(result).not.toContain('>View trading rules</a>')
    expect(result).toContain('View project details')
    expect(result).not.toContain('>View project details</a>')
    expect(result).toContain('class="app-project-summary__actions"')
    expect(result).not.toContain('Submit metric')
    expect(result).toContain(
      'View and amend your project details, including project name and target percentage'
    )
  })

  test('returns not found when the backend cannot find the project', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      Object.assign(new Error('Not found'), {
        data: {
          isResponseError: true,
          res: { statusCode: statusCodes.notFound },
          payload: null
        }
      })
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('returns bad gateway when the backend is unavailable', async () => {
    vi.mocked(wreck.get).mockRejectedValue(new Error('Connection refused'))

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('returns bad gateway for an unsuccessful backend response', async () => {
    vi.mocked(wreck.get).mockRejectedValue(
      Object.assign(new Error('Service unavailable'), {
        data: {
          isResponseError: true,
          res: { statusCode: 503 },
          payload: null
        }
      })
    )

    const { statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.badGateway)
  })

  test('uses safe display defaults for missing or malformed unit data', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          baseline: {
            habitats: [{}],
            hedgerows: [{}],
            watercourses: [{}],
            units: {
              habitatsTotal: 'not-a-number',
              treesTotal: Number.POSITIVE_INFINITY
            }
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('>Project</span>')
    expect(result.match(/N\/A/g)).toHaveLength(3)
    expect(result).not.toContain('-100.00%')
    expect(result).not.toContain('Not met')
    expect(result).not.toContain('-0.00 units')
    expect(result.match(/0.00 units/g)).toHaveLength(9)
  })

  test('keeps present zero-unit habitat categories and shows N/A without a status', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Area-only project',
          baseline: {
            habitats: [{}],
            hedgerows: [{}],
            watercourses: [{}],
            units: {
              habitatsTotal: 1,
              hedgerowsTotal: 0,
              watercoursesTotal: 0
            }
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result.match(/N\/A/g)).toHaveLength(2)
    expect(result.match(/-100.00%/g)).toHaveLength(1)
    expect(result.match(/Not met/g)).toHaveLength(1)
  })

  test.each([
    ['AC1: baseline-only project without hedgerows', 'hedgerows', false],
    ['AC2: baseline and PI project without hedgerows', 'hedgerows', true],
    ['AC3: baseline-only project without watercourses', 'watercourses', false],
    ['AC4: baseline and PI project without watercourses', 'watercourses', true]
  ])(
    'hides %s from the navigation and main page',
    async (_, habitatType, withPi) => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: projectWithoutHabitatTypes([habitatType], withPi)
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/project-summary`,
        auth
      })
      const $ = load(result)
      const navigation = $('nav[aria-label="Project summary"]')
      const label = habitatType === 'hedgerows' ? 'Hedgerows' : 'Watercourses'

      expect(statusCode).toBe(statusCodes.ok)
      expect(navigation.text()).not.toContain(label)
      expect($(`#${habitatType}-heading`)).toHaveLength(0)
      expect($('.app-unit-type-summary')).toHaveLength(2)
    }
  )

  test.each([
    ['baseline-only', false],
    ['baseline and PI', true]
  ])(
    'shows only area habitats for a %s project without either linear habitat type',
    async (_, withPi) => {
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: projectWithoutHabitatTypes(
          ['hedgerows', 'watercourses'],
          withPi
        )
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/project-summary`,
        auth
      })
      const $ = load(result)
      const navigation = $('nav[aria-label="Project summary"]')

      expect(statusCode).toBe(statusCodes.ok)
      expect(navigation.find('li')).toHaveLength(2)
      expect(navigation.text()).toContain('Area habitats')
      expect(navigation.text()).not.toContain('Hedgerows')
      expect(navigation.text()).not.toContain('Watercourses')
      expect($('.app-unit-type-summary')).toHaveLength(1)
      expect($('#area-habitats-heading')).toHaveLength(1)
    }
  )

  test.each(['hedgerows', 'watercourses'])(
    'keeps %s visible when absent from baseline but present post-intervention',
    async (habitatType) => {
      const createdOnlyProject = projectWithoutHabitatTypes(
        [habitatType],
        true,
        'baseline'
      )
      createdOnlyProject.project.postIntervention[habitatType][0] = {
        retentionCategory: 'Created'
      }
      const interventionUnits =
        createdOnlyProject.project.postIntervention.units
      interventionUnits[`${habitatType}NetUnitChange`] = 2
      interventionUnits[`${habitatType}NetUnitChangePercentage`] = null
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: createdOnlyProject
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/project-summary`,
        auth
      })
      const $ = load(result)
      const label = habitatType === 'hedgerows' ? 'Hedgerows' : 'Watercourses'
      const unitSummary = $(`#${habitatType}-heading`).closest('section')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('nav[aria-label="Project summary"]').text()).toContain(label)
      expect(unitSummary).toHaveLength(1)
      expect(unitSummary.text()).toContain('N/A')
      expect(unitSummary.text()).toContain('0.00 units')
      expect(unitSummary.text().match(/2.00 units/g)).toHaveLength(2)
      expect(unitSummary.find('.govuk-tag')).toHaveLength(0)
    }
  )

  test.each(['hedgerows', 'watercourses'])(
    'keeps %s visible when present in baseline but absent post-intervention',
    async (habitatType) => {
      const baselineOnlyHabitatProject = projectWithoutHabitatTypes(
        [habitatType],
        true,
        'postIntervention'
      )
      const interventionUnits =
        baselineOnlyHabitatProject.project.postIntervention.units
      interventionUnits[`${habitatType}NetUnitChange`] = -1
      interventionUnits[`${habitatType}NetUnitChangePercentage`] = -100
      vi.mocked(wreck.get).mockResolvedValue({
        res: { statusCode: statusCodes.ok },
        payload: baselineOnlyHabitatProject
      })

      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: `/projects/${PROJECT_ID}/project-summary`,
        auth
      })
      const $ = load(result)
      const label = habitatType === 'hedgerows' ? 'Hedgerows' : 'Watercourses'
      const unitSummary = $(`#${habitatType}-heading`).closest('section')

      expect(statusCode).toBe(statusCodes.ok)
      expect($('nav[aria-label="Project summary"]').text()).toContain(label)
      expect(unitSummary).toHaveLength(1)
      expect(unitSummary.text()).toContain('-100.00%')
      expect(unitSummary.text()).toContain('1.00 units')
      expect(unitSummary.text()).toContain('0.00 units')
      expect(unitSummary.text()).toContain('-1.00 units')
      expect(unitSummary.find('.govuk-tag--red').text()).toBe('Not met')
    }
  )

  test('renders post-intervention values and includes changed tree units in the area summary', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: projectWithPostIntervention
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })
    const $ = load(result)
    const areaSummary = $('#area-habitats-heading').closest('section')
    const hedgerowSummary = $('#hedgerows-heading').closest('section')
    const watercourseSummary = $('#watercourses-heading').closest('section')

    expect(statusCode).toBe(statusCodes.ok)
    expect(areaSummary.text()).toContain('60.00%')
    expect(areaSummary.text()).toContain('16.00 units')
    expect(areaSummary.text()).toContain('6.00 units')
    expect(hedgerowSummary.text()).toContain('50.00%')
    expect(hedgerowSummary.text()).toContain('6.00 units')
    expect(hedgerowSummary.text()).toContain('2.00 units')
    expect(watercourseSummary.text()).toContain('-50.00%')
    expect(watercourseSummary.text()).toContain('5.00 units')
    expect(watercourseSummary.text()).toContain('-5.00 units')
    expect($('.govuk-tag--green')).toHaveLength(2)
    expect($('.govuk-tag--green').text()).toBe('MetMet')
    expect($('.govuk-tag--red')).toHaveLength(1)
    expect($('.govuk-tag--red').text()).toBe('Not met')
  })

  test('renders post-intervention headings and text-only actions', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: projectWithPostIntervention
    })

    const { result } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })
    const $ = load(result)
    const interventionHeadings = $('h3').filter((_, heading) =>
      $(heading).text().includes('On-site post-intervention')
    )

    expect(interventionHeadings).toHaveLength(3)
    expect(result.match(/View on-site post intervention/g)).toHaveLength(3)
    expect(result).not.toContain('Upload on-site post intervention file')
    expect($('a[href*="/upload-file?"]')).toHaveLength(1)
    expect(
      $('a').filter((_, link) =>
        $(link).text().includes('View on-site post intervention')
      )
    ).toHaveLength(0)
  })

  test('shows N/A for missing post-intervention unit values', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: {
        project: {
          name: 'Incomplete post-intervention data',
          baseline: {
            habitats: [{}],
            hedgerows: [{}],
            watercourses: [{}],
            units: {
              habitatsTotal: 1,
              treesTotal: 0,
              hedgerowsTotal: 1,
              watercoursesTotal: 1
            }
          },
          postIntervention: {
            habitats: [{}],
            hedgerows: [{}],
            watercourses: [{}],
            units: {}
          }
        }
      }
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result.match(/N\/A/g)).toHaveLength(9)
    expect(result).not.toContain('-0.00')
  })

  test('redirects a project without baseline data to the existing task list', async () => {
    vi.mocked(wreck.get).mockResolvedValue({
      res: { statusCode: statusCodes.ok },
      payload: { project: { name: 'No baseline' } }
    })

    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe(`/add-project-details/${PROJECT_ID}`)
  })

  test('rejects an invalid project id', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/projects/not-a-uuid/project-summary',
      auth
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(wreck.get).not.toHaveBeenCalled()
  })

  test('requires authentication', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })

  test('requires an approved BNG completer role', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: `/projects/${PROJECT_ID}/project-summary`,
      auth: {
        strategy: 'session',
        credentials: { ...auth.credentials, roles: [] }
      }
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
    expect(wreck.get).not.toHaveBeenCalled()
  })
})

describe('formatUnits', () => {
  test.each([
    [1.234567890123456, '1.23'],
    [12345678901234.56, '12345678901234.60'],
    [-1.235, '-1.24'],
    [-0.004, '0.00'],
    [-0, '0.00'],
    [null, '0.00'],
    [Number.NaN, '0.00']
  ])('formats %s as %s', (value, expected) => {
    expect(formatUnits(value)).toBe(expected)
  })
})

describe('percentageSummary', () => {
  test.each([
    [10, '10.00%', 'Met', 'govuk-tag--green'],
    [9.999, '10.00%', 'Met', 'govuk-tag--green'],
    [9.994, '9.99%', 'Not met', 'govuk-tag--red'],
    [-0.004, '0.00%', 'Not met', 'govuk-tag--red'],
    [-1, '-1.00%', 'Not met', 'govuk-tag--red']
  ])('maps %s to %s and %s', (value, netPercentageChange, text, classes) => {
    expect(percentageSummary(value)).toEqual({
      netPercentageChange,
      status: { text, classes }
    })
  })

  test.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'maps %s to N/A without a status',
    (value) => {
      expect(percentageSummary(value)).toEqual({
        netPercentageChange: 'N/A',
        status: null
      })
    }
  )
})
