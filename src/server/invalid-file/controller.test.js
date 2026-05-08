import { vi, describe, test, beforeAll, afterAll, expect } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants.js'
import { invalidFileController } from './controller.js'

const authCredentials = {
  sub: 'test-user-123',
  email: 'test@example.com',
  roles: ['aaa-bbb:bng completer:1']
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

  test('serves the page at /invalid-file', async () => {
    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(statusCode).toBe(statusCodes.ok)
  })

  test('renders the expected page title', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
      auth: authedAuth
    })

    expect(result).toEqual(
      expect.stringContaining(
        '<title>Biodiversity Net Gain - There is a problem with your file</title>'
      )
    )
  })

  test('renders fallback copy when no baseline errors are in session', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/invalid-file',
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
      url: '/invalid-file'
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
      'invalid-file/index',
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
      'invalid-file/index',
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
      'invalid-file/index',
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
      'invalid-file/index',
      expect.objectContaining({ errorList: [], projectId: null })
    )
  })
})
