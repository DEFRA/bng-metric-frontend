import { describe, test, expect } from 'vitest'

import { buildWatercourseViewOnlyViewModel } from '../post-intervention-habitat-details/watercourse-view-only-view-model.js'
import { renderTemplate } from '../test-helpers/render-template.js'

const projectId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const baselineFeatureId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'

const feature = {
  ref: 'W-1',
  sizeMetres: 1234.56,
  units: 6.5,
  retentionCategory: 'Retained',
  proposed: {
    type: 'Ditches',
    condition: '4. Moderate',
    conditionScore: 2,
    distinctiveness: 'Low',
    distinctivenessScore: 4,
    watercourseEncroachment: 'Minor',
    waterEncroachmentMultiplier: 0.8,
    riparianEncroachment: 'Minor/No Encroachment',
    riparianEncroachmentMultiplier: 0.98
  }
}

function render(overrides = {}) {
  return renderTemplate(
    'habitat-details/pi-watercourse-details.njk',
    buildWatercourseViewOnlyViewModel(feature, {
      projectId,
      projectName: 'Test Project',
      baselineFeatureId,
      ...overrides
    })
  )
}

// Template-level coverage for the redesigned page — the controller tests
// mock h.view, so only this proves the redesigned page actually renders.
describe('pi-watercourse-details template (retained watercourse)', () => {
  test('renders the parcel ref as the H1 with the project name as caption', () => {
    const html = render()

    expect(html).toMatch(/data-testid="app-heading-title">W-1</)
    expect(html).toMatch(/data-testid="app-heading-caption">Test Project</)
    // The fixed page name is the single section heading, not the H1.
    expect(html).toContain('Post-intervention habitat details')
    // The old summary-list Reference row is gone — the ref moved to the H1.
    expect(html).not.toContain('>Reference<')
  })

  test('renders every stacked row with the expected labels and values', () => {
    const html = render()

    for (const label of [
      'Intervention',
      'Size (kilometres)',
      'Habitat type',
      'Distinctiveness',
      'Condition',
      'Watercourse encroachment',
      'Riparian encroachment',
      'Strategic significance'
    ]) {
      expect(html).toContain(`>${label}</h3>`)
    }
    expect(html).toContain('Retained')
    // Plain numeric length — the label names the unit, so no "km" suffix.
    expect(html).toContain('>1.23456</p>')
    expect(html).not.toContain('1.23456km')
    expect(html).toContain('Low (4)')
    expect(html).toContain('Moderate (2)')
    // Encroachment values render with the multiplier derived from them.
    expect(html).toContain('Minor (0.8)')
    expect(html).toContain('Minor/No Encroachment (0.98)')
    expect(html).toContain('Low (1)')
  })

  test('renders the bordered "Habitat units delivered" summary row', () => {
    const html = render()

    expect(html).toContain('app-units-delivered')
    expect(html).toContain('Habitat units delivered')
    expect(html).toContain('6.50')
    expect(html).not.toContain('Units in this habitat')
  })

  test('is read-only: no form controls anywhere on the page', () => {
    const html = render()

    expect(html).not.toContain('<select')
    expect(html).not.toContain('<button')
    expect(html).not.toContain('<form')
  })

  test('shows the "View baseline details" link only when a baseline feature matches', () => {
    const withLink = render()
    expect(withLink).toContain('View baseline details')
    expect(withLink).toContain(
      `/baseline-habitat-details?featureId=${baselineFeatureId}&amp;projectId=${projectId}`
    )

    const withoutLink = render({ baselineFeatureId: null })
    expect(withoutLink).not.toContain('View baseline details')
  })
})
