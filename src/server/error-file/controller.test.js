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
        code: 'SLIVERS_INSIDE_REDLINE',
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

  test('multiple validation errors leaves singleError null (checked against raw session errors, not the sliver-merged visible list)', async () => {
    // AREA_PARCELS_OUTSIDE_REDLINE + SLIVERS_OUTSIDE_REDLINE collapse to one
    // visible block in the multi-error view, but that's still two distinct
    // errors from the backend — BMD-405 is scoped to exactly one.
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
    expect(view.singleError).toBeNull()
    expect(view.errorBlocks).toHaveLength(1)
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
})
