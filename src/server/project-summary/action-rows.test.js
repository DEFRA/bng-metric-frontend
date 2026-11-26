import { buildActionRows } from './action-rows.js'

const PROJECT_ID = '11111111-1111-4111-8111-111111111111'
const NOTE =
  '(Entries may have been removed as part of the data validation process)'
const INCOMPLETE = { status: 'Incomplete' }
const COMPLETE = { status: 'Complete' }

const completeDetails = {
  surveyCompleters: 'A Surveyor',
  surveyCompletionDate: '01/06/2026',
  applicant: 'An Applicant',
  localPlanningAuthorityReference: 'E60000001',
  localPlanningAuthority: 'Hartlepool Borough Council'
}

function incomplete(retentionCategory) {
  return { ...INCOMPLETE, retentionCategory }
}

// A project with nothing left to do, plus whatever a test adds.
function projectWith(overrides = {}) {
  return {
    name: 'Riverbank restoration',
    details: completeDetails,
    baseline: { habitats: [COMPLETE], hedgerows: [], watercourses: [] },
    ...overrides
  }
}

function rowsFor(project) {
  return buildActionRows(project, PROJECT_ID)
}

describe('buildActionRows', () => {
  test('gives no rows when every habitat and the project details are complete', () => {
    expect(rowsFor(projectWith())).toEqual([])
  })

  describe('incomplete baseline habitats (AC3, AC6)', () => {
    test('gives a row for each unit type, in order, linking to its baseline list', () => {
      const rows = rowsFor(
        projectWith({
          baseline: {
            habitats: [INCOMPLETE, INCOMPLETE, COMPLETE],
            hedgerows: [INCOMPLETE, INCOMPLETE, INCOMPLETE],
            watercourses: [INCOMPLETE, COMPLETE, INCOMPLETE]
          }
        })
      )

      expect(rows).toEqual([
        {
          description: `2 incomplete baseline area habitat records. ${NOTE}`,
          linkText: 'View baseline area habitats list',
          href: `/projects/${PROJECT_ID}/area-baseline`,
          testId: 'action-incomplete-baseline-area'
        },
        {
          description: `3 incomplete baseline hedgerow habitat records. ${NOTE}`,
          linkText: 'View baseline hedgerows list',
          href: `/projects/${PROJECT_ID}/hedgerows-baseline`,
          testId: 'action-incomplete-baseline-hedgerows'
        },
        {
          description: `2 incomplete baseline watercourse habitat records. ${NOTE}`,
          linkText: 'View baseline watercourses list',
          href: `/projects/${PROJECT_ID}/watercourses-baseline-summary`,
          testId: 'action-incomplete-baseline-watercourses'
        }
      ])
    })

    test('counts trees and vertical habitats as area habitats', () => {
      const rows = rowsFor(
        projectWith({
          baseline: {
            habitats: [INCOMPLETE],
            trees: [INCOMPLETE, COMPLETE],
            verticalHabitats: [INCOMPLETE]
          }
        })
      )

      expect(rows.map(({ description }) => description)).toEqual([
        `3 incomplete baseline area habitat records. ${NOTE}`
      ])
    })

    test('leaves out a unit type with no incomplete habitat', () => {
      const rows = rowsFor(
        projectWith({
          baseline: {
            habitats: [COMPLETE],
            hedgerows: [INCOMPLETE, INCOMPLETE],
            watercourses: [COMPLETE]
          }
        })
      )

      expect(rows.map(({ testId }) => testId)).toEqual([
        'action-incomplete-baseline-hedgerows'
      ])
    })

    test.each([
      ['habitats', 'area habitat'],
      ['hedgerows', 'hedgerow habitat'],
      ['watercourses', 'watercourse habitat']
    ])('says "record" for one incomplete %s row', (habitatKey, noun) => {
      const rows = rowsFor(
        projectWith({ baseline: { [habitatKey]: [INCOMPLETE, COMPLETE] } })
      )

      expect(rows.map(({ description }) => description)).toEqual([
        `1 incomplete baseline ${noun} record. ${NOTE}`
      ])
    })
  })

  describe('incomplete post-intervention habitats (AC4, AC7)', () => {
    test('gives Enhanced rows then Created rows, each linking to its tab', () => {
      const rows = rowsFor(
        projectWith({
          postIntervention: {
            habitats: [
              incomplete('Created'),
              incomplete('Enhanced'),
              incomplete('Enhanced')
            ],
            hedgerows: [incomplete('Created'), incomplete('Enhanced')],
            watercourses: [
              incomplete('Enhanced'),
              incomplete('Created'),
              incomplete('Created')
            ]
          }
        })
      )

      expect(rows).toEqual([
        {
          description: `2 incomplete enhanced area habitat records. ${NOTE}`,
          linkText: 'View enhanced area habitats list',
          href: `/projects/${PROJECT_ID}/area-post-intervention#enhanced`,
          testId: 'action-incomplete-enhanced-area'
        },
        {
          description: `1 incomplete enhanced hedgerow habitat record. ${NOTE}`,
          linkText: 'View enhanced hedgerows list',
          href: `/projects/${PROJECT_ID}/hedgerows-post-intervention#enhanced`,
          testId: 'action-incomplete-enhanced-hedgerows'
        },
        {
          description: `1 incomplete enhanced watercourse habitat record. ${NOTE}`,
          linkText: 'View enhanced watercourses list',
          href: `/projects/${PROJECT_ID}/watercourses-post-intervention#enhanced`,
          testId: 'action-incomplete-enhanced-watercourses'
        },
        {
          description: `1 incomplete created area habitat record. ${NOTE}`,
          linkText: 'View created area habitats list',
          href: `/projects/${PROJECT_ID}/area-post-intervention#created`,
          testId: 'action-incomplete-created-area'
        },
        {
          description: `1 incomplete created hedgerow habitat record. ${NOTE}`,
          linkText: 'View created hedgerows list',
          href: `/projects/${PROJECT_ID}/hedgerows-post-intervention#created`,
          testId: 'action-incomplete-created-hedgerows'
        },
        {
          description: `2 incomplete created watercourse habitat records. ${NOTE}`,
          linkText: 'View created watercourses list',
          href: `/projects/${PROJECT_ID}/watercourses-post-intervention#created`,
          testId: 'action-incomplete-created-watercourses'
        }
      ])
    })

    test('counts trees and vertical habitats as area habitats', () => {
      const rows = rowsFor(
        projectWith({
          postIntervention: {
            habitats: [incomplete('Created')],
            trees: [incomplete('Created'), incomplete('Enhanced')],
            verticalHabitats: [incomplete('Created')]
          }
        })
      )

      expect(rows.map(({ description }) => description)).toEqual([
        `1 incomplete enhanced area habitat record. ${NOTE}`,
        `3 incomplete created area habitat records. ${NOTE}`
      ])
    })

    test('never gives a row for a Retained habitat, or one with no intervention type', () => {
      const rows = rowsFor(
        projectWith({
          postIntervention: {
            habitats: [incomplete('Retained'), INCOMPLETE],
            hedgerows: [incomplete('1. Retained')],
            watercourses: [incomplete('Retained')]
          }
        })
      )

      expect(rows).toEqual([])
    })

    test('reads an intervention type written with its list number', () => {
      const rows = rowsFor(
        projectWith({
          postIntervention: { hedgerows: [incomplete('3. Created')] }
        })
      )

      expect(rows.map(({ testId }) => testId)).toEqual([
        'action-incomplete-created-hedgerows'
      ])
    })

    test('ignores complete habitats', () => {
      const rows = rowsFor(
        projectWith({
          postIntervention: {
            habitats: [{ ...COMPLETE, retentionCategory: 'Created' }],
            hedgerows: [{ ...COMPLETE, retentionCategory: 'Enhanced' }]
          }
        })
      )

      expect(rows).toEqual([])
    })
  })

  test('counts what the project holds: baseline rows come before post-intervention rows when both have incomplete habitats', () => {
    const rows = rowsFor(
      projectWith({
        baseline: { trees: [INCOMPLETE] },
        postIntervention: { hedgerows: [incomplete('Created')] }
      })
    )

    expect(rows.map(({ testId }) => testId)).toEqual([
      'action-incomplete-baseline-area',
      'action-incomplete-created-hedgerows'
    ])
  })

  describe('incomplete project details (AC5, AC8)', () => {
    const detailsRow = {
      description: 'Complete your project details',
      linkText: 'View and update project details',
      href: `/project-details/${PROJECT_ID}?returnUrl=%2Fprojects%2F${PROJECT_ID}%2Fproject-summary`,
      testId: 'action-project-details'
    }

    test('gives the row, returning to the summary, when the project has no details', () => {
      expect(rowsFor(projectWith({ details: null }))).toEqual([detailsRow])
    })

    test.each([
      ['surveyCompleters', null],
      ['surveyCompleters', ''],
      ['surveyCompleters', '   '],
      ['surveyCompletionDate', null],
      ['applicant', undefined]
    ])('gives the row when %s is %j', (field, value) => {
      const rows = rowsFor(
        projectWith({ details: { ...completeDetails, [field]: value } })
      )

      expect(rows).toEqual([detailsRow])
    })

    test.each([[undefined], [''], ['  ']])(
      'gives the row when the project name is %j',
      (name) => {
        expect(rowsFor(projectWith({ name }))).toEqual([detailsRow])
      }
    )

    test('gives the row when there is no local planning authority at all', () => {
      const rows = rowsFor(
        projectWith({
          details: {
            ...completeDetails,
            localPlanningAuthorityReference: null,
            localPlanningAuthority: ''
          }
        })
      )

      expect(rows).toEqual([detailsRow])
    })

    test('takes an authority name saved before the list existed as populated', () => {
      const rows = rowsFor(
        projectWith({
          details: {
            ...completeDetails,
            localPlanningAuthorityReference: null,
            localPlanningAuthority: 'Hartlepool'
          }
        })
      )

      expect(rows).toEqual([])
    })

    test('does not need the planning application reference or type', () => {
      const rows = rowsFor(
        projectWith({
          details: {
            ...completeDetails,
            planningApplicationReference: null,
            planningApplicationType: ''
          }
        })
      )

      expect(rows).toEqual([])
    })

    test('comes after every habitat row', () => {
      const rows = rowsFor(
        projectWith({
          details: null,
          baseline: { watercourses: [INCOMPLETE] },
          postIntervention: { habitats: [incomplete('Created')] }
        })
      )

      expect(rows.map(({ testId }) => testId)).toEqual([
        'action-incomplete-baseline-watercourses',
        'action-incomplete-created-area',
        'action-project-details'
      ])
    })
  })
})
