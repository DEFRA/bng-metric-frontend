/**
 * Assert that the shared `page.njk` layout landmarks rendered.
 *
 * `axe-core` only checks markup that's present in the DOM — a landmark that's
 * silently missing entirely (e.g. from a broken `page.njk` block override)
 * produces no violation, it just isn't checked. This is a plain presence
 * check to catch that case instead.
 * @param {Document} document
 */
export function assertLayoutLandmarks(document) {
  expect(document.querySelector('header .govuk-header')).not.toBeNull()
  expect(document.querySelector('.govuk-service-navigation')).not.toBeNull()
  expect(document.querySelector('.govuk-phase-banner')).not.toBeNull()
  expect(document.querySelector('footer .govuk-footer')).not.toBeNull()
}
