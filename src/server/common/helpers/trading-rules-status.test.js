import { describe, expect, test } from 'vitest'

import {
  areaTradingRulesStatus,
  watercourseTradingRulesStatus
} from './trading-rules-status.js'

const projectWith = (statuses) => ({
  tradingRuleStatuses: statuses
})

const areaProject = (areaHabitats) => projectWith({ areaHabitats })
const watercourseProject = (watercourses) => projectWith({ watercourses })

describe.each([
  ['area habitats', areaTradingRulesStatus, areaProject],
  ['watercourses', watercourseTradingRulesStatus, watercourseProject]
])('%s tradingRulesStatus', (_label, statusFor, projectFor) => {
  test('renders Met as a green tag', () => {
    expect(
      statusFor(projectFor({ medium: 'Met', low: 'Met', overall: 'Met' }))
    ).toEqual({ text: 'Met', classes: 'govuk-tag--green' })
  })

  test('renders Not met as a red tag', () => {
    expect(
      statusFor(
        projectFor({ medium: 'Not met', low: 'Met', overall: 'Not met' })
      )
    ).toEqual({ text: 'Not met', classes: 'govuk-tag--red' })
  })

  test('reads the site-wide verdict, not either band on its own', () => {
    // The Low band can pass while the site fails. Showing the Low band here
    // would tell a site it is compliant when it is not.
    const status = statusFor(
      projectFor({ medium: 'Not met', low: 'Met', overall: 'Not met' })
    )

    expect(status.text).toBe('Not met')
  })

  test.each([
    ['no project', undefined],
    ['no statuses on the response', {}],
    ['no statuses for this unit type', { tradingRuleStatuses: {} }],
    ['a null verdict', projectFor({ medium: null, low: null, overall: null })],
    ['an unrecognised verdict', projectFor({ overall: 'Probably' })]
  ])('shows nothing for %s', (_case, project) => {
    // The backend returns nulls where a post-intervention file was uploaded
    // without its figures, or (for watercourses) where trading rules do not
    // apply. Unknown is not failed, so no tag.
    expect(statusFor(project)).toBeNull()
  })

  test('leaves the Not met for an un-uploaded project to the backend', () => {
    // A baseline with no post-intervention file is Not met — nothing has been
    // delivered to trade against — but that verdict is reached in the engine,
    // not restated here. Here it is just another Not met.
    expect(
      statusFor(projectFor({ medium: null, low: null, overall: 'Not met' }))
    ).toEqual({ text: 'Not met', classes: 'govuk-tag--red' })
  })
})
