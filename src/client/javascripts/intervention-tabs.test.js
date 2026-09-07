// @vitest-environment happy-dom
import { initInterventionTabs } from './intervention-tabs.js'

const TABS_HTML = `
  <div class="govuk-tabs app-habitat-intervention-tabs">
    <ul class="govuk-tabs__list">
      <li class="govuk-tabs__list-item govuk-tabs__list-item--selected" data-panel-id="retained">
        <span class="govuk-tabs__tab" aria-current="true">Retained</span>
      </li>
      <li class="govuk-tabs__list-item" data-panel-id="enhanced">
        <a class="govuk-tabs__tab" href="#enhanced">Enhanced</a>
      </li>
      <li class="govuk-tabs__list-item" data-panel-id="created">
        <a class="govuk-tabs__tab" href="#created">Created</a>
      </li>
    </ul>
    <div class="govuk-tabs__panel" id="retained">Retained panel</div>
    <div class="govuk-tabs__panel govuk-tabs__panel--hidden" id="enhanced">Enhanced panel</div>
    <div class="govuk-tabs__panel govuk-tabs__panel--hidden" id="created">Created panel</div>
  </div>
`

function selectedTab() {
  return document.querySelector(
    '.govuk-tabs__list-item--selected .govuk-tabs__tab'
  )
}

function clickTab(label) {
  const link = Array.from(document.querySelectorAll('a.govuk-tabs__tab')).find(
    (tab) => tab.textContent.trim() === label
  )
  link.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
}

function clickTabItem(panelId) {
  document
    .querySelector(`[data-panel-id="${panelId}"]`)
    .dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))
}

describe('initInterventionTabs', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    window.location.hash = ''
  })

  test('does nothing when the page has no intervention tabs', () => {
    document.body.innerHTML = '<p>No tabs</p>'
    expect(() => initInterventionTabs()).not.toThrow()
  })

  test('does nothing when the tab list is missing', () => {
    document.body.innerHTML =
      '<div class="govuk-tabs app-habitat-intervention-tabs"></div>'
    expect(() => initInterventionTabs()).not.toThrow()
  })

  test('leaves the first tab as plain text on load', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().getAttribute('aria-current')).toBe('true')
    expect(selectedTab().textContent.trim()).toBe('Retained')
    expect(
      document
        .querySelector('#retained')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(false)
  })

  test('turns the clicked tab into plain text and restores the previous tab as a link', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    clickTab('Enhanced')

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Enhanced')
    expect(selectedTab().getAttribute('aria-current')).toBe('true')
    expect(
      document
        .querySelector('#enhanced')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(false)
    expect(
      document
        .querySelector('#retained')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(true)

    const retainedLink = Array.from(
      document.querySelectorAll('a.govuk-tabs__tab')
    ).find((tab) => tab.textContent.trim() === 'Retained')
    expect(retainedLink).toBeDefined()
    expect(retainedLink.getAttribute('href')).toBe('#retained')
    expect(retainedLink.hasAttribute('aria-current')).toBe(false)
  })

  test('activates a tab when the list item is clicked rather than the inner link', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    clickTabItem('created')

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Created')
    expect(
      document
        .querySelector('#created')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(false)
  })

  test('activates the matching tab when the URL hash changes after load', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    window.location.hash = '#enhanced'
    window.dispatchEvent(new Event('hashchange'))

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Enhanced')
  })

  test('ignores clicks that are not on an inactive tab link', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    selectedTab().dispatchEvent(
      new Event('click', { bubbles: true, cancelable: true })
    )

    expect(selectedTab().textContent.trim()).toBe('Retained')
    expect(selectedTab().tagName).toBe('SPAN')
  })

  test('selects the tab matching the URL hash on load', () => {
    window.location.hash = '#created'
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Created')
    expect(
      document
        .querySelector('#created')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(false)
    expect(
      document
        .querySelector('#retained')
        .classList.contains('govuk-tabs__panel--hidden')
    ).toBe(true)
  })

  test('keeps the already-selected tab as plain text when the hash matches it', () => {
    window.location.hash = '#retained'
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Retained')
  })

  test('ignores a hash that does not match a tab', () => {
    window.location.hash = '#missing'
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    expect(selectedTab().textContent.trim()).toBe('Retained')
  })

  test('ignores an empty hash', () => {
    window.location.hash = '#'
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    expect(selectedTab().textContent.trim()).toBe('Retained')
  })

  test('updates the URL hash without requiring a second click', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    clickTab('Created')

    expect(window.location.hash).toBe('#created')
  })

  test('moves focus to the tab that was activated and makes it focusable', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    clickTab('Enhanced')

    const active = selectedTab()
    expect(active.tagName).toBe('SPAN')
    expect(active.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).toBe(active)
  })

  test('does not steal focus when the tab is selected via a hash change', () => {
    document.body.innerHTML = TABS_HTML
    initInterventionTabs()

    window.location.hash = '#enhanced'
    window.dispatchEvent(new Event('hashchange'))

    expect(selectedTab().textContent.trim()).toBe('Enhanced')
    expect(document.activeElement).toBe(document.body)
  })

  test('skips a list item that has no tab label when switching', () => {
    document.body.innerHTML = `
      <div class="govuk-tabs app-habitat-intervention-tabs">
        <ul class="govuk-tabs__list">
          <li class="govuk-tabs__list-item govuk-tabs__list-item--selected" data-panel-id="retained">
            <span class="govuk-tabs__tab" aria-current="true">Retained</span>
          </li>
          <li class="govuk-tabs__list-item" data-panel-id="empty"></li>
          <li class="govuk-tabs__list-item" data-panel-id="enhanced">
            <a class="govuk-tabs__tab" href="#enhanced">Enhanced</a>
          </li>
        </ul>
        <div class="govuk-tabs__panel" id="retained">Retained panel</div>
        <div class="govuk-tabs__panel govuk-tabs__panel--hidden" id="enhanced">Enhanced panel</div>
      </div>
    `
    initInterventionTabs()
    clickTab('Enhanced')

    expect(selectedTab().textContent.trim()).toBe('Enhanced')
    expect(selectedTab().tagName).toBe('SPAN')
  })

  test('ignores a tab link that is not inside a list item', () => {
    document.body.innerHTML = TABS_HTML
    const stray = document.createElement('a')
    stray.className = 'govuk-tabs__tab'
    stray.href = '#enhanced'
    stray.textContent = 'Stray'
    document.querySelector('.govuk-tabs__list').appendChild(stray)
    initInterventionTabs()

    stray.dispatchEvent(new Event('click', { bubbles: true, cancelable: true }))

    expect(selectedTab().textContent.trim()).toBe('Retained')
  })

  test('still switches tabs when a panel element is missing', () => {
    document.body.innerHTML = `
      <div class="govuk-tabs app-habitat-intervention-tabs">
        <ul class="govuk-tabs__list">
          <li class="govuk-tabs__list-item govuk-tabs__list-item--selected" data-panel-id="retained">
            <span class="govuk-tabs__tab" aria-current="true">Retained</span>
          </li>
          <li class="govuk-tabs__list-item" data-panel-id="enhanced">
            <a class="govuk-tabs__tab" href="#enhanced">Enhanced</a>
          </li>
        </ul>
        <div class="govuk-tabs__panel" id="retained">Retained panel</div>
      </div>
    `
    initInterventionTabs()
    clickTab('Enhanced')

    expect(selectedTab().tagName).toBe('SPAN')
    expect(selectedTab().textContent.trim()).toBe('Enhanced')
    expect(window.location.hash).toBe('#enhanced')
  })

  test('does not fail when a list item has no panel id', () => {
    document.body.innerHTML = `
      <div class="govuk-tabs app-habitat-intervention-tabs">
        <ul class="govuk-tabs__list">
          <li class="govuk-tabs__list-item govuk-tabs__list-item--selected" data-panel-id="retained">
            <span class="govuk-tabs__tab" aria-current="true">Retained</span>
          </li>
          <li class="govuk-tabs__list-item">
            <a class="govuk-tabs__tab" href="#enhanced">Enhanced</a>
          </li>
        </ul>
        <div class="govuk-tabs__panel" id="retained">Retained panel</div>
      </div>
    `
    initInterventionTabs()
    clickTab('Enhanced')

    expect(selectedTab().textContent.trim()).toBe('Enhanced')
  })
})
