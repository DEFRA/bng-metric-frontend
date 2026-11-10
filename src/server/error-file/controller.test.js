import { vi, describe, test, beforeAll, afterAll, expect } from 'vitest'
import { load } from 'cheerio'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { invalidFileController } from './controller.js'
import { dropoutCopy } from './dropout-copy.js'

const authCredentials = {
  sub: 'test-user-123',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:3']
}

const authedAuth = {
  strategy: 'session',
  credentials: authCredentials
}

describe('#invalidFileController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('serves the page at /error-file', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/error-file',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the expected page title', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/error-file',
      auth: authedAuth
    })

    expect(result).toMatch(
      /<title>\s*There is a problem with your file - Biodiversity Net Gain\s*<\/title>/
    )
  })

  test('renders fallback copy when no baseline errors are in session', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/error-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining('There is a problem with your file')
    )
    // The copy is escaped as any text is, so read it as the user does.
    expect(load(result)('main').text()).toContain("couldn't accept your file")
  })

  test('redirects unauthenticated requests', async () => {
    const { statusCode, headers } = await server.inject({
      method: 'GET',
      url: '/error-file'
    })

    expect(statusCode).toBe(statusCodes.redirect)
    expect(headers.location).toBe('/auth/forbidden')
  })
})

describe('invalidFileController.handler — populated session', () => {
  const makeRequest = (sessionData) => {
    const store = { ...sessionData }
    return {
      yar: {
        get: vi.fn((key) => store[key] ?? null),
        set: vi.fn(),
        clear: vi.fn((key) => {
          delete store[key]
        })
      }
    }
  }

  const makeH = () => ({ view: vi.fn().mockReturnThis() })

  test('shows a heading for each comment validation error', async () => {
    const errors = [
      {
        code: 'COMMENT_INVALID_CHARACTERS',
        message:
          'One or more comments contain characters that are not valid UTF-8: areas fid 1'
      },
      {
        code: 'COMMENT_TOO_LONG',
        message:
          'One or more comments are longer than 999 characters: areas fid 2'
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error-file/index',
      expect.objectContaining({
        singleError: null,
        errorBlocks: [
          expect.objectContaining({
            heading:
              'One or more comments contain characters that are not valid UTF-8'
          }),
          expect.objectContaining({
            heading: 'One or more comments are longer than 999 characters'
          })
        ]
      })
    )
  })

  test('passes errorList and projectId to the view from session', async () => {
    const errors = [
      { code: 'NO_HABITAT_AREAS', message: 'not shown' },
      { code: 'REDLINE_INVALID_GEOMETRY', message: 'not shown' }
    ]
    const request = makeRequest({
      baselineValidationErrors: errors,
      baselineValidationErrorsProjectId: 'proj-456'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error-file/index',
      expect.objectContaining({
        errorList: [
          { text: 'Baseline file contains no area habitat polygons' },
          { text: 'Redline boundary geometry is invalid' }
        ],
        projectId: 'proj-456'
      })
    )
  })

  test("errorBlocks: heading and bullet are the copy's, filled from details; items list per-feature offenders from details.sample", async () => {
    const errors = [
      // Non-list error — heading filled from details, no items.
      {
        code: 'REDLINE_AREA_TOO_LARGE',
        message: 'not shown',
        details: { areaSqM: 123456789.4 }
      },
      // Non-list error with an item — one bullet, from details.
      {
        code: 'REDLINE_INVALID_GEOMETRY',
        message: 'not shown',
        details: { reason: 'Self-intersection', location: 'POINT(0 0)' }
      },
      // List error — items rendered from details.sample using "Feature Ref"
      // labels and the (and N more) tail when count > sample.length.
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        message:
          'One or more area habitat polygons are not entirely within the redline boundary: Feature Ref H001 (and 1 more)',
        details: {
          count: 2,
          sample: [
            {
              idx: 0,
              fid: '1',
              feature_ref: 'H001',
              escape_area_sqm: 9500,
              escape_location_wkt: 'POLYGON((0 0,1 1,2 2,0 0))'
            }
          ]
        }
      },
      // Pair-shaped sample (overlaps).
      {
        code: 'PARCEL_OVERLAPS',
        message:
          'One or more area habitat parcels overlap with other parcels: Feature Ref H002 ↔ Feature Ref H003',
        details: {
          count: 1,
          sample: [
            {
              idx_a: 0,
              fid_a: '2',
              feature_ref_a: 'H002',
              idx_b: 1,
              fid_b: '3',
              feature_ref_b: 'H003'
            }
          ]
        }
      }
      // SLIVERS_OUTSIDE_REDLINE is intentionally omitted here — it gets
      // suppressed by the controller when AREA_PARCELS_OUTSIDE_REDLINE is
      // present (covered by a dedicated test below).
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error-file/index',
      expect.objectContaining({
        errorBlocks: [
          {
            heading:
              'Redline boundary area (123456789 sq m) exceeds the 100 sq km limit',
            items: [],
            more: 0
          },
          {
            heading: 'Redline boundary geometry is invalid',
            items: ['Self-intersection at POINT(0 0)'],
            more: 0
          },
          {
            heading:
              'One or more area habitat polygons are not entirely within the redline boundary',
            items: [
              'Feature Ref H001 — ~9500.00 sq m near POLYGON((0 0,1 1,2 2,0 0))'
            ],
            more: 1
          },
          {
            heading:
              'One or more area habitat parcels overlap with other parcels',
            items: ['Feature Ref H002 ↔ Feature Ref H003'],
            more: 0
          }
        ]
      })
    )
  })

  test('errorBlocks: suppresses SLIVERS_OUTSIDE_REDLINE when AREA_PARCELS_OUTSIDE_REDLINE is present (merged into one section)', async () => {
    const errors = [
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        message:
          'One or more area habitat polygons are not entirely within the redline boundary: …',
        details: {
          count: 1,
          sample: [
            {
              idx: 0,
              fid: '1',
              feature_ref: 'H001',
              escape_area_sqm: 1.5,
              escape_location_wkt: 'POLYGON((0 0,1 0,1 1,0 1,0 0))'
            }
          ]
        }
      },
      {
        code: 'SLIVERS_OUTSIDE_REDLINE',
        message: 'Baseline file contains habitat parcel parts outside …',
        details: {
          count: 1,
          sample: [
            { area_sqm: 1.5, location_wkt: 'POLYGON((0 0,1 0,1 1,0 1,0 0))' }
          ]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toHaveLength(1)
    expect(view.errorBlocks[0].heading).toMatch(/area habitat polygons/)
  })

  test('errorBlocks: keeps SLIVERS_OUTSIDE_REDLINE when AREA_PARCELS_OUTSIDE_REDLINE is absent', async () => {
    // Defensive — AC7 firing without AC8 is unusual (same threshold) but
    // shouldn't be silently dropped just because the merge logic exists.
    const errors = [
      {
        code: 'SLIVERS_OUTSIDE_REDLINE',
        message: 'Baseline file contains habitat parcel parts outside …',
        details: {
          count: 1,
          sample: [
            { area_sqm: 1.5, location_wkt: 'POLYGON((0 0,1 0,1 1,0 1,0 0))' }
          ]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toHaveLength(1)
    expect(view.errorBlocks[0].items[0]).toContain(
      '~1.50 sq m near POLYGON((0 0,1 0,1 1,0 1,0 0))'
    )
  })

  test('errorBlocks: AREA_PARCELS_INVALID_GEOMETRY appends per-row reason in parentheses', async () => {
    const errors = [
      {
        code: 'AREA_PARCELS_INVALID_GEOMETRY',
        message: 'One or more area habitat polygons have invalid geometry: …',
        details: {
          count: 2,
          sample: [
            {
              idx: 0,
              fid: '1',
              feature_ref: 'H001',
              reason: 'Self-intersection'
            },
            // No reason → renders as Feature Ref only (no parens).
            { idx: 1, fid: '2', feature_ref: 'H002' }
          ]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual([
      'Feature Ref H001 (Self-intersection)',
      'Feature Ref H002'
    ])
  })

  test('errorBlocks: AREA_PARCELS_OUTSIDE_REDLINE without escape fields renders the bare Feature Ref', async () => {
    // Backwards compatibility: backend may not always emit escape geometry
    // (e.g. older clients of the validator). The describeFeatureWithEscape
    // helper short-circuits to the plain feature label.
    const errors = [
      {
        code: 'AREA_PARCELS_OUTSIDE_REDLINE',
        message:
          'One or more area habitat polygons are not entirely within the redline boundary: …',
        details: {
          count: 1,
          sample: [{ idx: 0, fid: '1', feature_ref: 'H001' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual(['Feature Ref H001'])
  })

  test('errorBlocks: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE lists offending parcels with habitat type and band (V.High → "Very high")', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: Feature Ref H001 (and 1 more)',
        details: {
          count: 3,
          allowedBands: ['Medium', 'Low', 'V.Low'],
          sample: [
            {
              idx: 0,
              fid: '1',
              feature_ref: 'H001',
              habitat_type: 'Grassland - Lowland meadows',
              distinctiveness: 'V.High'
            },
            {
              idx: 1,
              fid: '2',
              feature_ref: 'H002',
              habitat_type: 'Woodland and forest - Wet woodland',
              distinctiveness: 'High'
            }
          ]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toEqual([
      {
        heading:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service',
        note: 'Allowed distinctiveness: Medium, Low and Very low.',
        items: [
          'Feature Ref H001 — Grassland - Lowland meadows (Very high)',
          'Feature Ref H002 — Woodland and forest - Wet woodland (High)'
        ],
        more: 1
      }
    ])
  })

  test('errorBlocks: BMD-1182 BASELINE_NOT_ENHANCEABLE lists each enhanced habitat with its baseline type and condition', async () => {
    const errors = [
      {
        code: 'BASELINE_NOT_ENHANCEABLE',
        message:
          'One or more habitats are enhanced, but their baseline habitat cannot be enhanced in this service: Feature Ref H001, Feature Ref HG1',
        details: {
          count: 2,
          sample: [
            {
              layer: 'habitats',
              feature_ref: 'H001',
              habitat_type: 'Grassland - Other neutral grassland',
              condition: 'Good',
              distinctiveness: 'Medium',
              rule: 'medium-area-good',
              mvsOnly: true
            },
            {
              layer: 'hedgerows',
              feature_ref: 'HG1',
              habitat_type: 'Non-native and ornamental hedgerow',
              condition: '',
              distinctiveness: 'V.Low',
              rule: 'very-low-hedgerow',
              mvsOnly: false
            }
          ]
        }
      },
      { code: 'NO_REDLINE', message: 'No red line boundary' }
    ]
    const request = makeRequest({
      postInterventionValidationErrors: errors,
      validationUploadType: 'postIntervention'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0]).toEqual({
      heading:
        'One or more habitats are enhanced, but their baseline habitat cannot be enhanced in this service',
      items: [
        'Feature Ref H001 — Grassland - Other neutral grassland (Good)',
        'Feature Ref HG1 — Non-native and ornamental hedgerow'
      ],
      more: 0
    })
  })

  describe('BMD-1195 BASELINE_HABITATS_INCOMPLETE', () => {
    const incompleteBaseline = {
      code: 'BASELINE_HABITATS_INCOMPLETE',
      message:
        'One or more baseline habitats are incomplete, so this post-intervention file cannot replace the project baseline: Feature Ref H002, habitats fid 7',
      details: {
        count: 2,
        sample: [
          {
            layer: 'habitats',
            idx: 1,
            fid: 2,
            feature_ref: 'H002',
            habitat_type: 'Ground based green wall'
          },
          {
            layer: 'watercourses',
            idx: 0,
            fid: 7,
            feature_ref: null,
            habitat_type: null
          }
        ]
      }
    }

    async function render(errors) {
      const request = makeRequest({
        postInterventionValidationErrors: errors,
        validationUploadType: 'postIntervention'
      })
      const h = makeH()
      await invalidFileController.handler(request, h)
      return h.view.mock.calls[0][1]
    }

    test('lists each incomplete baseline habitat, with its habitat type when it has one', async () => {
      const view = await render([
        incompleteBaseline,
        { code: 'NO_REDLINE', message: 'No red line boundary' }
      ])

      expect(view.errorBlocks[0]).toEqual({
        heading:
          'One or more baseline habitats are incomplete, so this post-intervention file cannot replace the project baseline',
        items: ['Feature Ref H002 — Ground based green wall', 'fid 7'],
        more: 0
      })
    })

    test('alone, shows the placeholder page awaiting UCD, naming its heading and bullets, not the service message', async () => {
      const view = await render([incompleteBaseline])

      expect(view.singleError.helpText).toBe(
        'PLACEHOLDER - One or more baseline habitats are incomplete, so this post-intervention file cannot replace the project baseline: Feature Ref H002 — Ground based green wall, fid 7'
      )
    })
  })

  test('errorBlocks: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE falls back when habitat_type / distinctiveness are missing', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: …',
        details: {
          count: 1,
          allowedBands: ['Medium', 'Low', 'V.Low'],
          sample: [{ idx: 0, fid: '7' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual([
      'fid 7 — unknown habitat (unknown)'
    ])
  })

  test('errorBlocks: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE omits the note when allowedBands is missing', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: Feature Ref H001',
        details: {
          count: 1,
          sample: [{ feature_ref: 'H001', distinctiveness: 'V.High' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].note).toBeUndefined()
  })

  test('errorBlocks: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE omits the note when allowedBands is empty', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: Feature Ref H001',
        details: {
          count: 1,
          allowedBands: [],
          sample: [{ feature_ref: 'H001', distinctiveness: 'V.High' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].note).toBeUndefined()
  })

  test('errorBlocks: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE renders a single-band note without "and"', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: Feature Ref H001',
        details: {
          count: 1,
          allowedBands: ['Medium'],
          sample: [{ feature_ref: 'H001', distinctiveness: 'V.High' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].note).toBe('Allowed distinctiveness: Medium.')
  })

  test('errorList: HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE summary entry includes the allowed-bands note', async () => {
    const errors = [
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message:
          'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service: Feature Ref H001',
        details: {
          count: 1,
          allowedBands: ['Medium', 'Low', 'V.Low'],
          sample: [{ feature_ref: 'H001', distinctiveness: 'V.High' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorList).toEqual([
      {
        text: 'One or more habitats have a distinctiveness that is out of scope for the BNG Beta service. Allowed distinctiveness: Medium, Low and Very low.'
      }
    ])
  })

  test('errorBlocks: sliver row uses defensive fallbacks for missing area / location', async () => {
    // Defensive branches in describeSliver — area_sqm defaults to 0,
    // location_wkt defaults to "unknown location".
    const errors = [
      {
        code: 'SLIVERS_OUTSIDE_REDLINE',
        message: 'Baseline file contains slivers …',
        details: {
          count: 1,
          sample: [{}]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual([
      '~0.00 sq m near unknown location'
    ])
  })

  test('errorBlocks: BMD-1058 habitat reference errors are one heading each, with no habitats listed', async () => {
    const sample = Array.from({ length: 50 }, (_, idx) => ({
      layer: 'areas',
      idx,
      fid: idx + 1
    }))
    const errors = [
      {
        code: 'HABITAT_REF_MISSING',
        message: 'Every habitat must have a Parcel Ref: areas fid 1, …',
        details: { count: 53, sample }
      },
      {
        code: 'HABITAT_REF_INVALID_CHARACTERS',
        message: 'One or more Parcel Refs contain characters …: areas fid 9',
        details: { count: 1, sample: [{ layer: 'areas', idx: 8, fid: 9 }] }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toEqual([
      {
        heading: 'Your file contains a habitat with no habitat reference',
        items: [],
        more: 0
      },
      {
        heading:
          'This habitat reference contains characters that are not allowed',
        items: [],
        more: 0
      }
    ])
    expect(view.errorList).toEqual([
      { text: 'Your file contains a habitat with no habitat reference' },
      {
        text: 'This habitat reference contains characters that are not allowed'
      }
    ])
  })

  test('errorBlocks: VERTICAL_HABITAT_AREA_NOT_POSITIVE rows name the habitat and the Area it holds', async () => {
    const errors = [
      {
        code: 'VERTICAL_HABITAT_AREA_NOT_POSITIVE',
        message:
          'One or more vertical area habitats have an Area that is not a number above 0',
        details: {
          count: 3,
          sample: [
            { idx: 0, fid: 1, feature_ref: 'V001', area: -12 },
            { idx: 1, fid: 2, feature_ref: 'V002', area: '' },
            { idx: 2, fid: 3, feature_ref: null, area: null }
          ]
        }
      }
    ]
    const h = makeH()

    await invalidFileController.handler(
      makeRequest({ baselineValidationErrors: errors }),
      h
    )

    expect(h.view.mock.calls[0][1].errorBlocks[0].items).toEqual([
      'Feature Ref V001 (Area: -12)',
      'Feature Ref V002 (Area: blank)',
      'fid 3 (Area: blank)'
    ])
  })

  test('errorBlocks: AREA_PARCELS_TOO_SMALL rows name the parcel and its area', async () => {
    const errors = [
      {
        code: 'AREA_PARCELS_TOO_SMALL',
        message: 'One or more area habitat parcels are slivers …',
        details: {
          count: 2,
          sample: [
            { idx: 0, fid: '1', feature_ref: 'P001', area_sqm: 0.32 },
            { idx: 1, fid: '2', feature_ref: null }
          ]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual([
      'Feature Ref P001 — ~0.32 sq m',
      'fid 2'
    ])
  })

  test('errorBlocks: more=0 when details present but count is missing', async () => {
    const errors = [
      {
        code: 'TREES_OUTSIDE_REDLINE',
        message:
          'One or more trees are not entirely within the redline boundary: …',
        details: {
          // count intentionally omitted — exercises the `?? 0` branch.
          sample: [{ idx: 0, fid: '1', feature_ref: 'T001' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].more).toBe(0)
  })

  test('errorBlocks: more=0 when details present but sample is missing', async () => {
    // details exists but sample is undefined — exercises the `sample?.length`
    // optional-chain on line 86.
    const errors = [
      {
        code: 'TREES_OUTSIDE_REDLINE',
        message:
          'One or more trees are not entirely within the redline boundary: …',
        details: { count: 5 }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].more).toBe(5)
    // sample is missing, and the copy gives the code a heading, so the
    // service's message names no bullet. The point of this test is just to
    // exercise the `sample?.length ?? 0` branch in buildBlock.
    expect(view.errorBlocks[0].items).toEqual([])
    // Alone, the code shows its list, which keeps the count.
    expect(view.singleError).toBeNull()
  })

  test("errorBlocks: a code the copy gives a heading shows none of the service's message", async () => {
    const errors = [
      { code: 'NO_REDLINE', message: 'Not shown: nor this' },
      {
        code: 'COMMENT_TOO_LONG',
        message: 'Not shown: nor this',
        details: { count: 1, sample: [{ layer: 'areas', fid: 2, idx: 1 }] }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toEqual([
      {
        heading: 'Baseline file contains no redline boundary polygon',
        items: [],
        more: 0
      },
      {
        heading: 'One or more comments are longer than 999 characters',
        items: ['fid 2'],
        more: 0
      }
    ])
  })

  test("errorBlocks: fills a heading's counts from details, as the service writes them", async () => {
    const errors = [
      { code: 'NO_REDLINE', message: 'Not shown' },
      {
        code: 'GPKG_TOO_MANY_FEATURES',
        message: 'Not shown',
        details: { featureCount: 12345, maxFeatureCount: 10000 }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[1].heading).toBe(
      'GeoPackage contains 12,345 features across its boundary, habitat, hedgerow and watercourse layers; the maximum this service can validate is 10,000'
    )
  })

  test("errorBlocks: a heading whose values the details lack is the catch-all title, never the service's message", async () => {
    const errors = [
      { code: 'NO_REDLINE', message: 'Not shown' },
      { code: 'GPKG_TOO_MANY_FEATURES', message: 'Not shown: nor this' }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[1]).toEqual({
      heading: 'Your Geopackage (.gpkg) file contains an error',
      items: [],
      more: 0
    })
  })

  test('errorBlocks: a code the copy does not have is headed by the catch-all title', async () => {
    const errors = [
      { code: 'NO_REDLINE', message: 'Not shown' },
      { code: 'A_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown: nor this' }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[1]).toEqual({
      heading: 'Your Geopackage (.gpkg) file contains an error',
      items: [],
      more: 0
    })
  })

  describe('errorBlocks: a block the page words the same way twice', () => {
    const CATCH_ALL_BLOCK = {
      heading: 'Your Geopackage (.gpkg) file contains an error',
      items: [],
      more: 0
    }

    const outsideRedline = (featureRef, count = 1) => ({
      code: 'AREA_PARCELS_OUTSIDE_REDLINE',
      message: 'Not shown',
      details: {
        count,
        sample: [{ idx: 0, fid: '1', feature_ref: featureRef }]
      }
    })

    const outOfScope = (allowedBands) => ({
      code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
      message: 'Not shown',
      details: {
        count: 1,
        sample: [
          {
            idx: 0,
            fid: '1',
            feature_ref: 'H001',
            habitat_type: 'Woodland and forest - Wet woodland',
            distinctiveness: 'High'
          }
        ],
        allowedBands
      }
    })

    async function viewFor(errors) {
      const request = makeRequest({ baselineValidationErrors: errors })
      const h = makeH()
      await invalidFileController.handler(request, h)
      return h.view.mock.calls[0][1]
    }

    test('is shown once, in the blocks and the list alike', async () => {
      const view = await viewFor([
        { code: 'NO_REDLINE', message: 'Not shown' },
        { code: 'A_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown' },
        { code: 'ANOTHER_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown' }
      ])

      expect(view.errorBlocks).toHaveLength(2)
      expect(view.errorBlocks[1]).toEqual(CATCH_ALL_BLOCK)
      expect(view.errorList).toEqual(
        view.errorBlocks.map((block) => ({ text: block.heading }))
      )
      expect(view.singleError).toBeNull()
    })

    test('keeps the list page when two errors merge into one block', async () => {
      const view = await viewFor([
        { code: 'A_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown' },
        { code: 'ANOTHER_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown' }
      ])

      // Two problems are still two: the single-error page words one.
      expect(view.errorBlocks).toEqual([CATCH_ALL_BLOCK])
      expect(view.errorList).toEqual([{ text: CATCH_ALL_BLOCK.heading }])
      expect(view.singleError).toBeNull()
      expect(view.pageTitle).toBe('There is a problem with your file')
    })

    test('keeps a catch-all block beside one with its own heading', async () => {
      const view = await viewFor([
        { code: 'NO_REDLINE', message: 'Not shown' },
        { code: 'A_CODE_THE_COPY_HAS_NOT_MET', message: 'Not shown' }
      ])

      expect(view.errorBlocks).toHaveLength(2)
      expect(view.errorBlocks[0].heading).not.toBe(CATCH_ALL_BLOCK.heading)
    })

    test('keeps the same code twice when its bullets differ', async () => {
      const view = await viewFor([
        outsideRedline('H001'),
        outsideRedline('H002')
      ])

      expect(view.errorBlocks).toHaveLength(2)
      expect(view.errorBlocks[0].heading).toBe(view.errorBlocks[1].heading)
    })

    test('keeps a shared heading when the count of more habitats differs', async () => {
      const view = await viewFor([
        outsideRedline('H001'),
        outsideRedline('H001', 3)
      ])

      expect(view.errorBlocks.map((block) => block.more)).toEqual([0, 2])
    })

    test('keeps a shared heading when the note differs', async () => {
      const view = await viewFor([
        outOfScope(['Medium', 'Low', 'V.Low']),
        outOfScope(['Low'])
      ])

      expect(view.errorBlocks).toHaveLength(2)
      expect(view.errorBlocks[0].note).not.toBe(view.errorBlocks[1].note)
    })
  })

  test('errorBlocks: an srs_id the file does not set is shown as the copy words it', async () => {
    const errors = [
      { code: 'NO_REDLINE', message: 'Not shown' },
      {
        code: 'GPKG_BASELINE_SRS_ID',
        message: 'Not shown',
        details: {
          layer: 'Habitats',
          expectedSrsId: 27700,
          contentsSrsId: null,
          variants: ['contents']
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[1].items).toEqual([
      'expected srs_id 27700 but gpkg_contents has unset'
    ])
  })

  test('errorBlocks: a variant named in details replaces the heading or item it words', async () => {
    const errors = [
      {
        code: 'GPKG_BASELINE_SRS_ID',
        message: 'Not shown',
        details: {
          layer: 'Habitats',
          expectedSrsId: 27700,
          contentsSrsId: '4326',
          variants: ['contents', 'bng-service']
        }
      },
      {
        code: 'GPKG_BASELINE_COLUMN_SQLITE_TYPE',
        message: 'Not shown',
        details: {
          layer: 'Habitats',
          column: 'Area',
          expectedType: 'Real',
          actualType: 'Integer'
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks).toEqual([
      {
        heading: 'Layer "Habitats" does not match the BNG Service template',
        items: ['expected srs_id 27700 but gpkg_contents has 4326'],
        more: 0
      },
      {
        heading: 'Layer "Habitats" baseline mismatch',
        items: ['column "Area" has an Integer data type but Real was expected'],
        more: 0
      }
    ])
  })

  test("a lone problem with no copy of its own shows its list heading and bullets, not the service's message", async () => {
    const errors = [
      {
        code: 'TREES_OUTSIDE_REDLINE',
        message: 'Not shown',
        details: { count: 3, sample: [{ feature_ref: 'T1' }, { fid: 4 }] }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toBeNull()
    expect(view.pageTitle).not.toContain('PLACEHOLDER')
    expect(view.errorBlocks).toEqual([
      {
        heading:
          'One or more trees are not entirely within the redline boundary',
        items: ['Feature Ref T1', 'fid 4'],
        more: 1
      }
    ])
  })

  test('a lone problem shown as its list fills its heading from details, as the service writes the numbers', async () => {
    const errors = [
      {
        code: 'AREA_SUM_MISMATCH',
        message: 'Not shown',
        details: { habitatsAreaSqM: 100.123, redlineAreaSqM: 99 }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toBeNull()
    expect(view.errorBlocks[0].heading).toBe(
      'Sum of area habitat polygons (100.12 sq m) does not equal redline boundary area (99.00 sq m)'
    )
  })

  test('errorBlocks: describeFeature falls through to the bare "feature" label when no identifying fields are present', async () => {
    // Empty fid string + no idx + no feature_ref hits the final fallback.
    // Use a layer error code so the sample goes through describeFeature.
    const errors = [
      {
        code: 'IGGIS_OUTSIDE_REDLINE',
        message:
          'One or more IGGIs are not entirely within the redline boundary: …',
        details: {
          count: 1,
          sample: [{ fid: '' }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.errorBlocks[0].items).toEqual(['feature'])
  })

  test('errorBlocks: feature label falls back to fid then to "feature #idx"', async () => {
    const errors = [
      {
        code: 'HEDGEROWS_OUTSIDE_REDLINE',
        message: 'One or more hedgerow habitats are not entirely …',
        details: {
          count: 2,
          sample: [{ idx: 5, fid: '17', feature_ref: null }, { idx: 6 }]
        }
      }
    ]
    const request = makeRequest({ baselineValidationErrors: errors })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error-file/index',
      expect.objectContaining({
        errorBlocks: [
          expect.objectContaining({
            items: ['fid 17', 'feature #6']
          })
        ]
      })
    )
  })

  test('clears both session keys after rendering', async () => {
    const request = makeRequest({
      baselineValidationErrors: [{ code: 'X', message: 'x' }],
      baselineValidationErrorsProjectId: 'proj-456'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(request.yar.clear).toHaveBeenCalledWith('baselineValidationErrors')
    expect(request.yar.clear).toHaveBeenCalledWith(
      'baselineValidationErrorsProjectId'
    )
  })

  test('passes empty errorList and null projectId when session is empty', async () => {
    const request = makeRequest({})
    const h = makeH()

    await invalidFileController.handler(request, h)

    expect(h.view).toHaveBeenCalledWith(
      'error-file/index',
      expect.objectContaining({ errorList: [], projectId: null })
    )
  })
})

describe('invalidFileController.handler — BMD-405 single-error routing', () => {
  const makeRequest = (sessionData) => {
    const store = { ...sessionData }
    return {
      yar: {
        get: vi.fn((key) => store[key] ?? null),
        set: vi.fn(),
        clear: vi.fn((key) => {
          delete store[key]
        })
      }
    }
  }

  const makeH = () => ({ view: vi.fn().mockReturnThis() })

  test('exactly one validation error resolves singleError and uses its h1 as pageTitle', async () => {
    const request = makeRequest({
      baselineValidationErrors: [{ code: 'NO_REDLINE', message: 'x' }],
      baselineValidationErrorsProjectId: 'proj-456'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toEqual(
      expect.objectContaining({
        variant: 'standard',
        h1: 'Your Geopackage (.gpkg) file contains an error'
      })
    )
    expect(view.pageTitle).toBe(
      'Your Geopackage (.gpkg) file contains an error'
    )
  })

  test('zero validation errors leaves singleError null and uses the generic pageTitle', async () => {
    const request = makeRequest({})
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toBeNull()
    expect(view.pageTitle).toBe('There is a problem with your file')
  })

  test('AC10: AREA_PARCELS_OUTSIDE_REDLINE + its correlated SLIVERS_OUTSIDE_REDLINE resolves the personalised singleError', async () => {
    // These two codes always co-fire for the same escaping geometry (reported
    // from the per-parcel and union-of-parcels angle respectively), so BMD-405's
    // "exactly one error" precondition must be judged against the de-duplicated
    // visible list, not the raw backend code count, or this branch is dead code.
    const request = makeRequest({
      baselineValidationErrors: [
        {
          code: 'AREA_PARCELS_OUTSIDE_REDLINE',
          message: 'x',
          details: { sample: [{ feature_ref: 'P001' }] }
        },
        { code: 'SLIVERS_OUTSIDE_REDLINE', message: 'y', details: {} }
      ]
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toEqual(
      expect.objectContaining({
        variant: 'standard',
        h1: 'This parcel P001 contains an error'
      })
    )
    expect(view.errorBlocks).toHaveLength(1)
  })

  test('genuinely multiple validation errors (no correlation) leaves singleError null', async () => {
    const request = makeRequest({
      baselineValidationErrors: [
        {
          code: 'AREA_PARCELS_OUTSIDE_REDLINE',
          message: 'x',
          details: { sample: [{ feature_ref: 'P001' }] }
        },
        { code: 'SLIVERS_OUTSIDE_REDLINE', message: 'y', details: {} },
        { code: 'NO_REDLINE', message: 'z' }
      ]
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).toBeNull()
    expect(view.errorBlocks).toHaveLength(2)
  })

  test('single distinctiveness error resolves the distinctiveness variant and passes uploadHref through unaffected', async () => {
    const request = makeRequest({
      baselineValidationErrors: [
        { code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE', message: 'x' }
      ],
      baselineValidationErrorsProjectId: 'proj-789'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError.variant).toBe('metric-tool')
    expect(view.uploadHref).toBe('/projects/proj-789/upload-baseline-file')
  })

  test('post-intervention single error resolves uploadHref to the post-intervention upload route', async () => {
    const request = makeRequest({
      validationUploadType: 'postIntervention',
      postInterventionValidationErrors: [{ code: 'NO_REDLINE', message: 'x' }],
      postInterventionValidationErrorsProjectId: 'proj-100'
    })
    const h = makeH()

    await invalidFileController.handler(request, h)

    const view = h.view.mock.calls[0][1]
    expect(view.singleError).not.toBeNull()
    expect(view.uploadHref).toBe(
      '/projects/proj-100/upload-post-intervention-file'
    )
  })
})

describe('invalidFileController.handler — BMD-1086 BNG Service template lineage errors', () => {
  const makeRequest = (errors) => {
    const store = {
      postInterventionValidationErrors: errors,
      postInterventionValidationErrorsProjectId: 'proj-1086',
      validationUploadType: 'postIntervention'
    }
    return {
      yar: {
        get: vi.fn((key) => store[key] ?? null),
        set: vi.fn(),
        clear: vi.fn((key) => {
          delete store[key]
        })
      }
    }
  }

  const makeH = () => ({ view: vi.fn().mockReturnThis() })

  async function viewFor(errors) {
    const h = makeH()
    await invalidFileController.handler(makeRequest(errors), h)
    return h.view.mock.calls[0][1]
  }

  // The backend's message: its heading, then each offender as it names it.
  function lineageError(code, heading, sample, count = sample.length) {
    return {
      code,
      message: `${heading}: ${sample.map((s) => s.ref).join('; ')}`,
      stage: 'post-intervention',
      details: { count, sample }
    }
  }

  const POST_INTERVENTION_AREAS = 'Area Habitats Post-Intervention'
  const BASELINE_AREAS = 'Area Habitats Baseline'

  test('lists each row with no parent link or an unknown parent by its table, Habitat Ref and habitat type', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_PARENT_LINK_MISSING',
        'One or more Retained or Enhanced post-intervention habitats do not name the baseline habitat they continue',
        [
          {
            layer: 'areas',
            table: POST_INTERVENTION_AREAS,
            fid: 3,
            ref: 'H003',
            habitatType: 'Grassland - Other neutral grassland',
            parentUuid: null
          },
          { layer: 'hedgerows', table: 'Hedgerows Post-Intervention', fid: 7 }
        ],
        3
      ),
      lineageError(
        'STAGED_UNKNOWN_PARENT_REF',
        'One or more post-intervention habitats name a baseline habitat that is not in the file',
        [
          {
            layer: 'watercourses',
            table: 'Watercourses Post-Intervention',
            fid: 2,
            ref: 'R002',
            habitatType: 'Ditches',
            parentUuid: 'not-a-baseline-uuid'
          }
        ]
      )
    ])

    expect(view.errorBlocks).toEqual([
      {
        heading:
          'One or more Retained or Enhanced post-intervention habitats do not name the baseline habitat they continue',
        items: [
          'Area Habitats Post-Intervention H003 — Grassland - Other neutral grassland',
          'Hedgerows Post-Intervention fid 7'
        ],
        more: 1
      },
      {
        heading:
          'One or more post-intervention habitats name a baseline habitat that is not in the file',
        items: ['Watercourses Post-Intervention R002 — Ditches'],
        more: 0
      }
    ])
  })

  test('lists each changed or ambiguous parent with the post-intervention rows that name it', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_BASELINE_DRIFTED',
        'One or more baseline habitats do not have the shape their post-intervention habitats were copied from',
        [
          {
            layer: 'areas',
            table: BASELINE_AREAS,
            fid: 4,
            ref: 'H004',
            habitatType: 'Woodland and forest - Other woodland; broadleaved',
            childRefs: ['H004', 'H004b']
          }
        ]
      ),
      lineageError(
        'STAGED_AMBIGUOUS_PARENT',
        'One or more post-intervention habitats have a parent that matches more than one baseline habitat',
        [
          {
            layer: 'areas',
            table: BASELINE_AREAS,
            parentUuid: 'shared-uuid',
            refs: ['H010', 'H011'],
            habitatType: 'Grassland - Modified grassland',
            childRefs: ['H010']
          }
        ]
      )
    ])

    expect(view.errorBlocks.map(({ items }) => items)).toEqual([
      [
        'Area Habitats Baseline H004 — Woodland and forest - Other woodland; broadleaved, copied to H004, H004b'
      ],
      [
        'Area Habitats Baseline H010, H011 — Grassland - Modified grassland, named by H010'
      ]
    ])
  })

  test('lists each watercourse or hedgerow parent the Metric guide refuses, with its lengths where they are the reason', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_HEDGEROW_CHILDREN_TOO_LONG',
        'One or more baseline hedgerows are shorter than the post-intervention hedgerows linked to them together',
        [
          {
            layer: 'hedgerows',
            table: 'Hedgerows Baseline',
            fid: 1,
            ref: 'HG001',
            habitatType: 'Native hedgerow',
            childRefs: ['HG001', 'HG001b'],
            lengthMetres: 120.5,
            childLengthMetres: 131.25
          }
        ]
      ),
      lineageError(
        'STAGED_WATERCOURSE_RETAINED_AND_CREATED',
        'One or more baseline watercourses have both a Retained or Enhanced part and a Created part, so their length cannot be split between what continues and what is lost. Draw each as two baseline watercourses, one for each part',
        [
          {
            layer: 'watercourses',
            table: 'Watercourses Baseline',
            fid: 1,
            ref: 'R001',
            habitatType: 'Other rivers and streams',
            childRefs: ['R001', 'R001b']
          }
        ]
      ),
      lineageError(
        'STAGED_NATURAL_WATERCOURSE_LOST',
        'One or more baseline watercourses have no post-intervention habitat, but only a canal or a ditch can be permanently lost. Record each as Retained, Enhanced or Created',
        [
          {
            layer: 'watercourses',
            table: 'Watercourses Baseline',
            fid: 3,
            ref: 'R003',
            habitatType: 'Priority habitat',
            childRefs: []
          }
        ]
      )
    ])

    expect(
      view.errorBlocks.map(({ heading, items }) => [heading, items])
    ).toEqual([
      [
        'One or more baseline hedgerows are shorter than the post-intervention hedgerows linked to them together',
        [
          'Hedgerows Baseline HG001 — Native hedgerow, copied to HG001, HG001b (120.5 m, linked 131.25 m)'
        ]
      ],
      [
        'One or more baseline watercourses have both a Retained or Enhanced part and a Created part, so their length cannot be split between what continues and what is lost. Draw each as two baseline watercourses, one for each part',
        [
          'Watercourses Baseline R001 — Other rivers and streams, copied to R001, R001b'
        ]
      ],
      [
        'One or more baseline watercourses have no post-intervention habitat, but only a canal or a ditch can be permanently lost. Record each as Retained, Enhanced or Created',
        ['Watercourses Baseline R003 — Priority habitat']
      ]
    ])
  })

  test('lists each vertical area habitat whose rows together have more area than it, with both areas in hectares and square metres', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_VERTICAL_CHILDREN_TOO_LARGE',
        'One or more baseline vertical area habitats have a smaller Area (ha) than the post-intervention vertical area habitats linked to them together',
        [
          {
            layer: 'verticalHabitats',
            table: 'Vertical Area Habitats Baseline',
            fid: 1,
            ref: 'V001',
            habitatType: 'Facade-bound green wall',
            childRefs: ['V001a', 'V001b'],
            areaSquareMetres: 40,
            childAreaSquareMetres: 50.1
          },
          {
            layer: 'verticalHabitats',
            table: 'Vertical Area Habitats Baseline',
            fid: 2,
            ref: 'V002',
            habitatType: 'Ground based green wall',
            childRefs: ['V002a']
          }
        ]
      )
    ])

    expect(
      view.errorBlocks.map(({ heading, items }) => [heading, items])
    ).toEqual([
      [
        'One or more baseline vertical area habitats have a smaller Area (ha) than the post-intervention vertical area habitats linked to them together',
        [
          'Vertical Area Habitats Baseline V001 — Facade-bound green wall, copied to V001a, V001b; Area 0.004ha (40m²), linked 0.00501ha (50.1m²)',
          'Vertical Area Habitats Baseline V002 — Ground based green wall, copied to V002a'
        ]
      ]
    ])
  })

  test('lists each tree whose kept trees together count more than it, with both counts', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_TREE_CHILDREN_TOO_MANY',
        'One or more baseline trees have fewer trees than the Retained and Enhanced post-intervention trees linked to them together',
        [
          {
            layer: 'trees',
            table: 'Individual Trees Baseline',
            fid: 4,
            ref: 'T004',
            habitatType: 'Rural tree',
            childRefs: ['T004a', 'T004b'],
            count: 3,
            childCount: 4
          }
        ]
      )
    ])

    expect(
      view.errorBlocks.map(({ heading, items }) => [heading, items])
    ).toEqual([
      [
        'One or more baseline trees have fewer trees than the Retained and Enhanced post-intervention trees linked to them together. A tree that is kept cannot be more trees than it was',
        [
          'Individual Trees Baseline T004 — Rural tree, copied to T004a, T004b; Count 3, linked 4'
        ]
      ]
    ])
  })

  test('lists each irreplaceable tree, in the table of the stage that marks it, even alone', async () => {
    const tree = (table, ref, fid) => ({
      layer: 'trees',
      table,
      feature_ref: ref,
      fid,
      idx: fid - 1
    })
    const view = await viewFor([
      {
        code: 'IRREPLACEABLE_TREE',
        message:
          'One or more trees are marked as irreplaceable habitat. The service does not accept irreplaceable trees: Individual Trees Baseline Habitat Ref T001',
        stage: 'baseline',
        details: {
          count: 2,
          sample: [
            tree('Individual Trees Baseline', 'T001', 1),
            tree('Individual Trees Baseline', null, 7)
          ]
        }
      }
    ])

    expect(
      view.errorBlocks.map(({ heading, items }) => [heading, items])
    ).toEqual([
      [
        'One or more trees are marked as irreplaceable habitat. The service does not accept irreplaceable trees, such as ancient and veteran trees',
        [
          'Individual Trees Baseline Habitat Ref T001',
          'Individual Trees Baseline fid 7'
        ]
      ]
    ])
  })

  test('lists each degraded row with the parent it was copied from', async () => {
    const row = (code, ref, habitatType, parentRef) =>
      lineageError(code, `Heading for ${code}`, [
        {
          layer: 'hedgerows',
          table: 'Hedgerows Post-Intervention',
          fid: 9,
          ref,
          habitatType,
          parentRef
        }
      ])

    const view = await viewFor([
      row('STAGED_DEGRADE_NOT_WORSE', 'HG009', 'Native hedgerow', 'HG002'),
      row(
        'STAGED_DEGRADE_ADVANCE_NOT_30_PLUS',
        'HG010',
        'Native hedgerow with trees',
        'HG003'
      ),
      row('STAGED_WATERCOURSE_NO_INTERVENTION', 'R004', 'Ditches', null)
    ])

    expect(view.errorBlocks.map(({ items }) => items)).toEqual([
      [
        'Hedgerows Post-Intervention HG009 — Native hedgerow, copied from HG002'
      ],
      [
        'Hedgerows Post-Intervention HG010 — Native hedgerow with trees, copied from HG003'
      ],
      ['Hedgerows Post-Intervention R004 — Ditches']
    ])
  })

  test('falls back to "a habitat" when a sample names neither a ref nor a fid', async () => {
    const view = await viewFor([
      lineageError('STAGED_AMBIGUOUS_PARENT', 'Ambiguous', [
        { layer: 'areas', refs: [null], childRefs: [] }
      ])
    ])

    expect(view.errorBlocks[0].items).toEqual(['a habitat'])
  })

  test('shows a lone lineage error as its list of habitats, not as single-error copy', async () => {
    const view = await viewFor([
      lineageError(
        'STAGED_DEGRADE_ADVANCE_NOT_30_PLUS',
        'One or more habitats recorded as lost and created again in a lower condition are not created 30+ years in advance, as the Metric guide asks',
        [
          {
            layer: 'areas',
            table: POST_INTERVENTION_AREAS,
            fid: 12,
            ref: 'H012',
            habitatType: 'Grassland - Other neutral grassland',
            parentRef: 'H012'
          }
        ]
      )
    ])

    expect(view.singleError).toBeNull()
    expect(view.pageTitle).toBe('There is a problem with your file')
    expect(view.errorBlocks).toEqual([
      {
        heading:
          'One or more habitats recorded as lost and created again in a lower condition are not created 30+ years in advance, as the Metric guide asks',
        items: [
          'Area Habitats Post-Intervention H012 — Grassland - Other neutral grassland, copied from H012'
        ],
        more: 0
      }
    ])
  })

  test('shows a lone lineage error that collates several habitats as its whole list, keeping the count beyond the sample', async () => {
    const sample = ['H001', 'H002', 'H003'].map((ref, index) => ({
      layer: 'areas',
      table: POST_INTERVENTION_AREAS,
      fid: index + 1,
      ref,
      habitatType: 'Grassland - Modified grassland',
      parentUuid: null
    }))
    const view = await viewFor([
      lineageError(
        'STAGED_PARENT_LINK_MISSING',
        'One or more Retained or Enhanced post-intervention habitats do not name the baseline habitat they continue',
        sample,
        53
      )
    ])

    expect(view.singleError).toBeNull()
    expect(view.errorBlocks).toEqual([
      {
        heading:
          'One or more Retained or Enhanced post-intervention habitats do not name the baseline habitat they continue',
        items: [
          'Area Habitats Post-Intervention H001 — Grassland - Modified grassland',
          'Area Habitats Post-Intervention H002 — Grassland - Modified grassland',
          'Area Habitats Post-Intervention H003 — Grassland - Modified grassland'
        ],
        more: 50
      }
    ])
  })

  test.each([
    [
      'TEMPLATE_VERSION_MISSING',
      undefined,
      'The file has no template version record, so it is not a BNG Service template file.'
    ],
    [
      'TEMPLATE_VERSION_DUPLICATED',
      { recordCount: 2 },
      'The file has 2 template version records, so its template version is unclear. It should have one.'
    ],
    [
      'TEMPLATE_VERSION_INVALID',
      undefined,
      "The file's template version record cannot be read, so its template version is unknown."
    ],
    [
      'TEMPLATE_VERSION_UNSUPPORTED',
      { version: '2.0', supportedVersions: ['1.0', '1.1'] },
      'The file is in version 2.0 of the BNG Service template, which the service does not read. It reads version 1.0, 1.1.'
    ],
    [
      'POST_INTERVENTION_TABLES_EMPTY',
      { template: { name: 'bng-service', version: '1.0' } },
      'The Post-Intervention tables in this file are all empty, so it has no post-intervention habitats to upload. Upload it as a baseline, or add the post-intervention habitats and upload it again.'
    ]
  ])(
    'shows a lone %s under its heading, with no placeholder title',
    async (code, details, heading) => {
      const view = await viewFor([
        { code, message: 'not shown', ...(details && { details }) }
      ])

      expect(view.singleError).toBeNull()
      expect(view.pageTitle).toBe('There is a problem with your file')
      expect(view.errorBlocks).toEqual([{ heading, items: [], more: 0 }])
    }
  )
  test('shows a lone LEGACY_TEMPLATE_NOT_ACCEPTED as single-error copy, not split at its colon', async () => {
    const view = await viewFor([
      {
        code: 'LEGACY_TEMPLATE_NOT_ACCEPTED',
        message:
          'This file is in the legacy Natural England template. The service now takes the BNG Service template: convert the file with the QGIS plugin, then upload it again.'
      }
    ])

    expect(view.singleError).toMatchObject({
      variant: 'text',
      h1: 'There is a problem with your file',
      subheading: 'Template',
      helpText:
        'Your file is using the legacy template. The service now uses the BNG service template.'
    })
  })
})

describe('invalidFileController.handler — bullets a habitat cannot fill', () => {
  async function blocksFor(errors) {
    const store = {
      baselineValidationErrors: errors,
      baselineValidationErrorsProjectId: 'proj-1'
    }
    const h = { view: vi.fn().mockReturnThis() }
    await invalidFileController.handler(
      {
        yar: {
          get: vi.fn((key) => store[key] ?? null),
          set: vi.fn(),
          clear: vi.fn()
        }
      },
      h
    )
    return h.view.mock.calls[0][1].errorBlocks
  }

  test('shows the one bullet of an error that sends no details', async () => {
    const [block] = await blocksFor([
      { code: 'LEGACY_TEMPLATE_NOT_ACCEPTED', message: 'Not shown' },
      { code: 'NO_REDLINE', message: 'No redline' }
    ])

    expect(block).toEqual({
      heading:
        'This file is in the legacy Natural England template. The service now takes the BNG Service template',
      items: ['convert the file with the QGIS plugin, then upload it again.'],
      more: 0
    })
  })

  describe('a value the file holds', () => {
    const NOT_LISTED = { code: 'NO_REDLINE', message: 'No redline' }
    const GEOMETRY_TYPE_ITEM =
      'expected geometry type "MULTIPOLYGON" in gpkg_geometry_columns but found'

    async function blockFor(code, details) {
      const [block] = await blocksFor([
        { code, message: 'Not shown', details },
        NOT_LISTED
      ])
      return block
    }

    test.each([
      ['blank', ''],
      ['null', null]
    ])(
      "names a %s geometry type with the copy's word, keeping the bullet",
      async (_, found) => {
        expect(
          await blockFor('GPKG_BASELINE_GEOMETRY_TYPE_NAME', {
            layer: 'Habitats',
            expected: 'MULTIPOLYGON',
            found
          })
        ).toEqual({
          heading: 'Layer "Habitats" baseline mismatch',
          items: [`${GEOMETRY_TYPE_ITEM} "blank"`],
          more: 0
        })
      }
    )

    test('names a geometry type the file registers as it is', async () => {
      const block = await blockFor('GPKG_BASELINE_GEOMETRY_TYPE_NAME', {
        layer: 'Habitats',
        expected: 'MULTIPOLYGON',
        found: 'POINT'
      })

      expect(block.items).toEqual([`${GEOMETRY_TYPE_ITEM} "POINT"`])
    })

    test('leaves the bullet out when the details do not carry the type', async () => {
      const block = await blockFor('GPKG_BASELINE_GEOMETRY_TYPE_NAME', {
        layer: 'Habitats',
        expected: 'MULTIPOLYGON'
      })

      expect(block.items).toEqual([])
    })

    test("names a blank data_type with the copy's word", async () => {
      const block = await blockFor('GPKG_BASELINE_CONTENTS_DATA_TYPE', {
        layer: 'Habitats',
        expected: 'features',
        found: ''
      })

      expect(block.items).toEqual([
        'expected data_type "features" in gpkg_contents but found "blank"'
      ])
    })

    test('heads a blank geometry column name with its own heading, not the catch-all', async () => {
      expect(
        await blockFor('GPKG_BASELINE_INVALID_GEOMETRY_COLUMN_NAME', {
          layer: 'Habitats',
          column: ''
        })
      ).toEqual({
        heading:
          'Layer "Habitats" geometry column "blank" has an invalid name in gpkg_geometry_columns',
        items: [],
        more: 0
      })
    })

    test('keeps the bullet for a blank geometry column name the template names', async () => {
      expect(
        await blockFor('GPKG_BASELINE_INVALID_GEOMETRY_COLUMN_NAME', {
          layer: 'Red Line Boundary',
          column: '',
          expected: 'geom',
          variants: ['named']
        })
      ).toEqual({
        heading:
          'Layer "Red Line Boundary" does not match the BNG Service template',
        items: ['its geometry column is named "blank" but should be "geom"'],
        more: 0
      })
    })

    test('names a blank registered geometry column that is missing', async () => {
      const block = await blockFor('GPKG_BASELINE_MISSING_COLUMN', {
        layer: 'Habitats',
        column: '',
        variants: ['geometry']
      })

      expect(block.items).toEqual(['missing geometry column "blank"'])
    })

    test('names a blank registered geometry column whose type is wrong', async () => {
      const block = await blockFor('GPKG_BASELINE_COLUMN_SQLITE_TYPE', {
        layer: 'Habitats',
        column: '',
        expectedType: 'MultiPolygon geometry',
        actualType: 'Text'
      })

      expect(block.items).toEqual([
        'column "blank" has a Text data type but MultiPolygon geometry was expected'
      ])
    })

    test('names a blank unexpected layer', async () => {
      const block = await blockFor('GPKG_UNEXPECTED_FEATURE_LAYER', {
        layer: ''
      })

      expect(block.heading).toBe(
        'Unexpected feature layer "blank" — not listed in baseline template schema'
      )
    })

    test('words srs_ids the file leaves unset, in the unreadable variant', async () => {
      expect(
        await blockFor('GPKG_BASELINE_SRS_ID', {
          layer: 'Habitats',
          expectedSrsId: 27700,
          contentsSrsId: null,
          geometryColumnsSrsId: null,
          variants: ['unreadable', 'bng-service']
        })
      ).toEqual({
        heading: 'Layer "Habitats" does not match the BNG Service template',
        items: [
          'expected srs_id 27700 but could not read a valid integer srs_id from gpkg_contents (unset) nor gpkg_geometry_columns (unset)'
        ],
        more: 0
      })
    })

    test('says nothing of srs_ids an error does not carry', async () => {
      expect(
        await blockFor('GPKG_BASELINE_GPKG_SRS_INCONSISTENT', undefined)
      ).toEqual({
        heading: 'Your Geopackage (.gpkg) file contains an error',
        items: [],
        more: 0
      })
    })

    test('words a column with no declared type, naming no actual type', async () => {
      expect(
        await blockFor('GPKG_BASELINE_COLUMN_SQLITE_TYPE', {
          layer: 'Habitats',
          column: 'Area',
          expectedType: 'Float',
          variants: ['undeclared']
        })
      ).toEqual({
        heading: 'Layer "Habitats" baseline mismatch',
        items: [
          'column "Area" has no SQLite column type declared but Float was expected'
        ],
        more: 0
      })
    })
  })

  describe('each variant the copy words', () => {
    const BASELINE = 'Layer "Habitats" baseline mismatch'
    const SERVICE = 'Layer "Habitats" does not match the BNG Service template'

    // One error the backend can send with each variant, and the block the
    // list shows for it.
    const CASES = {
      'GPKG_UNEXPECTED_FEATURE_LAYER bng-service': [
        { layer: 'Extra' },
        [
          'Unexpected feature layer "Extra" — not a table of the BNG Service template',
          []
        ]
      ],
      'GPKG_BASELINE_CONTENTS_DATA_TYPE bng-service': [
        { layer: 'Habitats', expected: 'features', found: 'tiles' },
        [
          SERVICE,
          ['expected data_type "features" in gpkg_contents but found "tiles"']
        ]
      ],
      'GPKG_BASELINE_SRS_ID bng-service': [
        { layer: 'Habitats', expectedSrsId: 27700, foundSrsId: 4326 },
        [SERVICE, ['expected srs_id 27700 but GeoPackage srs_id is 4326']]
      ],
      'GPKG_BASELINE_SRS_ID contents': [
        { layer: 'Habitats', expectedSrsId: 27700, contentsSrsId: 4326 },
        [BASELINE, ['expected srs_id 27700 but gpkg_contents has 4326']]
      ],
      'GPKG_BASELINE_SRS_ID unreadable': [
        {
          layer: 'Habitats',
          expectedSrsId: 27700,
          contentsSrsId: 'abc',
          geometryColumnsSrsId: 'def'
        },
        [
          BASELINE,
          [
            'expected srs_id 27700 but could not read a valid integer srs_id from gpkg_contents (abc) nor gpkg_geometry_columns (def)'
          ]
        ]
      ],
      'GPKG_BASELINE_INVALID_GEOMETRY_COLUMN_NAME named': [
        { layer: 'Habitats', column: 'geometry', expected: 'geom' },
        [
          SERVICE,
          ['its geometry column is named "geometry" but should be "geom"']
        ]
      ],
      'GPKG_BASELINE_MULTIPLE_GEOMETRY_COLUMNS bng-service': [
        { layer: 'Habitats', found: 2 },
        [
          SERVICE,
          [
            'expected exactly one geometry column in the feature table but found 2'
          ]
        ]
      ],
      'GPKG_BASELINE_MULTIPLE_GEOMETRY_COLUMNS registered': [
        { layer: 'Habitats', found: 2 },
        [
          BASELINE,
          [
            'expected exactly one geometry column in gpkg_geometry_columns but found 2'
          ]
        ]
      ],
      'GPKG_BASELINE_GEOMETRY_TYPE_NAME bng-service': [
        { layer: 'Habitats', expected: 'POLYGON', found: 'MULTIPOLYGON' },
        [
          SERVICE,
          [
            'expected geometry type "POLYGON" in gpkg_geometry_columns but found "MULTIPOLYGON"'
          ]
        ]
      ],
      'GPKG_BASELINE_MISSING_COLUMN bng-service': [
        { layer: 'Habitats', column: 'Habitat Ref' },
        [SERVICE, ['missing column "Habitat Ref"']]
      ],
      'GPKG_BASELINE_MISSING_COLUMN geometry': [
        { layer: 'Habitats', column: 'geom' },
        [BASELINE, ['missing geometry column "geom"']]
      ],
      'GPKG_BASELINE_COLUMN_SQLITE_TYPE bng-service': [
        {
          layer: 'Habitats',
          column: 'Area',
          expectedType: 'Float',
          actualType: 'Text'
        },
        [SERVICE, ['column "Area" has a Text data type but Float was expected']]
      ],
      'GPKG_BASELINE_COLUMN_SQLITE_TYPE not-scalar': [
        {
          layer: 'Habitats',
          column: 'Area',
          expectedType: 'Float',
          actualType: 'Point geometry'
        },
        [
          BASELINE,
          ['column "Area" has a Point geometry but Float was expected']
        ]
      ],
      'GPKG_BASELINE_COLUMN_SQLITE_TYPE undeclared': [
        { layer: 'Habitats', column: 'Area', expectedType: 'Float' },
        [
          BASELINE,
          [
            'column "Area" has no SQLite column type declared but Float was expected'
          ]
        ]
      ],
      'GPKG_BASELINE_COLUMN_NOT_NULL bng-service': [
        { layer: 'Habitats', column: 'Area' },
        [SERVICE, ['column "Area" NOT NULL (required) does not match file']]
      ],
      'GPKG_BASELINE_COLUMN_NOT_NULL optional': [
        { layer: 'Habitats', column: 'Comments' },
        [
          BASELINE,
          ['column "Comments" NOT NULL (optional) does not match file']
        ]
      ],
      'GPKG_BASELINE_COLUMN_PRIMARY_KEY bng-service': [
        { layer: 'Habitats', column: 'fid' },
        [SERVICE, ['primary key expectation for "fid" does not match file']]
      ],
      'GPKG_BASELINE_GEOMETRY_REGISTRATION_MISSING bng-service': [
        { layer: 'Habitats' },
        [SERVICE, ['no geometry column registered in gpkg_geometry_columns']]
      ],
      'GPKG_RLB_NO_GEOMETRY_COLUMN bng-service': [
        {},
        ['The Red Line Boundary table has no geometry column', []]
      ],
      'NO_HABITAT_AREAS structure': [
        {},
        ['Zero area habitat parcels in GeoPackage (expecting at least one)', []]
      ],
      'NO_DERIVED_BASELINE_HABITATS read': [
        {},
        [
          'The Area Habitats Baseline table in this file has no habitats, so it cannot replace the project baseline',
          []
        ]
      ]
    }

    test('has a case for every variant in the copy', () => {
      const worded = Object.entries(dropoutCopy.errors).flatMap(
        ([code, entry]) =>
          Object.keys(entry.inList?.variants ?? {}).map(
            (variant) => `${code} ${variant}`
          )
      )

      expect(Object.keys(CASES).sort()).toEqual(worded.sort())
    })

    test.each(Object.entries(CASES))(
      'words %s',
      async (key, [details, [heading, items]]) => {
        const [code, variant] = key.split(' ')
        const [block] = await blocksFor([
          {
            code,
            message: 'Not shown',
            details: { ...details, variants: [variant] }
          },
          { code: 'NO_REDLINE', message: 'No redline' }
        ])

        expect(block).toEqual({ heading, items, more: 0 })
      }
    )
  })

  test('names a habitat with no distinctiveness as unknown, rather than leaving its bullet out', async () => {
    const blocks = await blocksFor([
      {
        code: 'HABITAT_DISTINCTIVENESS_NOT_IN_SCOPE',
        message: 'Out of scope: H1',
        details: {
          count: 1,
          sample: [
            {
              feature_ref: 'H1',
              habitat_type: 'Grassland',
              distinctiveness: ''
            }
          ]
        }
      },
      { code: 'NO_REDLINE', message: 'No redline' }
    ])

    expect(blocks[0].items).toEqual(['Feature Ref H1 — Grassland (unknown)'])
  })

  test('names a blank habitat type as unknown, so the bullet keeps the habitat and its condition', async () => {
    const blocks = await blocksFor([
      {
        code: 'BASELINE_NOT_ENHANCEABLE',
        message: 'Not enhanceable: H2',
        details: {
          count: 1,
          sample: [{ feature_ref: 'H2', habitat_type: '', condition: 'Good' }]
        }
      },
      { code: 'NO_REDLINE', message: 'No redline' }
    ])

    expect(blocks[0].items).toEqual(['Feature Ref H2 — unknown habitat (Good)'])
  })

  test('names a habitat by its ref when no part of its bullet has its values', async () => {
    const blocks = await blocksFor([
      {
        code: 'SLIVERS_OUTSIDE_REDLINE',
        message: 'Slivers: x',
        // A blank location leaves "~{area} sq m near {location}" unfilled.
        details: { count: 1, sample: [{ feature_ref: 'S1', location_wkt: '' }] }
      },
      { code: 'NO_REDLINE', message: 'No redline' }
    ])

    expect(blocks[0].items).toEqual(['Feature Ref S1'])
  })
})
