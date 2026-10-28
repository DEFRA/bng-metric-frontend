import { vi, describe, test, beforeAll, afterAll, expect } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { invalidFileController } from './controller.js'

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
    expect(result).toEqual(expect.stringContaining("couldn't accept your file"))
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

  test('passes errorList and projectId to the view from session', async () => {
    const errors = [
      { code: 'NO_HABITAT_AREAS', message: 'No habitat areas' },
      { code: 'REDLINE_INVALID_GEOMETRY', message: 'Redline invalid' }
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
        errorList: [{ text: 'No habitat areas' }, { text: 'Redline invalid' }],
        projectId: 'proj-456'
      })
    )
  })

  test('errorBlocks: heading is the message prefix; items list per-feature offenders from details.sample', async () => {
    const errors = [
      // Non-list error with no ":" separator — heading is the full message,
      // items is empty.
      { code: 'NO_REDLINE', message: 'Baseline file contains no redline' },
      // Non-list error WITH a ":" separator — heading is the prefix, items
      // is the right side as a single line.
      {
        code: 'REDLINE_INVALID_GEOMETRY',
        message:
          'Redline boundary geometry is invalid: Self-intersection at POINT(0 0)'
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
            heading: 'Baseline file contains no redline',
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
      { heading: 'All habitats must have a reference', items: [], more: 0 },
      {
        heading:
          'One or more habitat references contain characters that are not allowed',
        items: [],
        more: 0
      }
    ])
    expect(view.errorList).toEqual([
      { text: 'All habitats must have a reference' },
      {
        text: 'One or more habitat references contain characters that are not allowed'
      }
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
    // sample is missing → buildItems falls through to message-split path,
    // so items is the post-colon remainder rather than []. The point of this
    // test is just to exercise the `sample?.length ?? 0` branch in buildBlock.
    expect(view.errorBlocks[0].items).toEqual(['…'])
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
    expect(view.singleError.variant).toBe('distinctiveness')
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
        'One or more post-intervention habitats name a baseline habitat whose feature_uuid more than one baseline habitat has',
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
      'The file has no template version record, so it is not a BNG Service template file.',
      []
    ],
    [
      'TEMPLATE_VERSION_DUPLICATED',
      'The file has 2 template version records, so its template version is unclear. It should have one.',
      []
    ],
    [
      'TEMPLATE_VERSION_INVALID',
      "The file's template version record cannot be read, so its template version is unknown.",
      []
    ],
    [
      'TEMPLATE_VERSION_UNSUPPORTED',
      'The file is in version 2.0 of the BNG Service template, which the service does not read. It reads version 1.0.',
      []
    ],
    [
      'POST_INTERVENTION_TABLES_EMPTY',
      'The Post-Intervention tables in this file are all empty, so it has no post-intervention habitats to upload. Upload it as a baseline, or add the post-intervention habitats and upload it again.',
      []
    ],
    [
      'LEGACY_TEMPLATE_NOT_ACCEPTED',
      'This file is in the legacy Natural England template. The service now takes the BNG Service template: convert the file with the QGIS plugin, then upload it again.',
      ['convert the file with the QGIS plugin, then upload it again.']
    ]
  ])(
    'shows a lone %s under the backend’s message, with no placeholder title',
    async (code, message, items) => {
      const view = await viewFor([{ code, message }])

      expect(view.singleError).toBeNull()
      expect(view.pageTitle).toBe('There is a problem with your file')
      expect(view.errorBlocks).toEqual([
        { heading: message.split(': ')[0], items, more: 0 }
      ])
    }
  )
})
