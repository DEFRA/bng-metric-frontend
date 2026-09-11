// @vitest-environment happy-dom
import { initInterventionTabs } from './intervention-tabs.js'

function renderTabs() {
  document.body.innerHTML = `
    <div class="app-habitat-intervention-tabs">
      <ul class="govuk-tabs__list">
        <li class="govuk-tabs__list-item govuk-tabs__list-item--selected" data-panel-id="retained">
          <span class="govuk-tabs__tab" aria-current="true" tabindex="-1">Retained</span>
        </li>
        <li class="govuk-tabs__list-item" data-panel-id="enhanced">
          <a class="govuk-tabs__tab" href="#enhanced">Enhanced</a>
        </li>
      </ul>
      <div id="retained" tabindex="-1"></div>
      <div id="enhanced" tabindex="-1" hidden></div>
    </div>`
}

describe('intervention tabs', () => {
  beforeEach(renderTabs)

  test('moves focus to the selected tab text and makes the old tab a link', () => {
    initInterventionTabs()
    document
      .querySelector('a[href="#enhanced"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

    const selectedTab = document.querySelector(
      '.govuk-tabs__list-item--selected .govuk-tabs__tab'
    )
    expect(selectedTab.tagName).toBe('SPAN')
    expect(selectedTab.textContent).toBe('Enhanced')
    expect(selectedTab.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(selectedTab)
    expect(document.querySelector('a[href="#retained"]')).not.toBeNull()
    expect(document.getElementById('retained').hidden).toBe(true)
    expect(document.getElementById('enhanced').hidden).toBe(false)
  })
})
