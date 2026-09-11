const ROOT_SELECTOR = '.app-habitat-intervention-tabs'

export function initInterventionTabs() {
  document.querySelectorAll(ROOT_SELECTOR).forEach((root) => {
    root
      .querySelector('.govuk-tabs__list')
      ?.addEventListener('click', (event) => {
        const link = event.target.closest('a.govuk-tabs__tab')
        if (!link || !root.contains(link)) return
        event.preventDefault()
        const selectedId = link.getAttribute('href').slice(1)
        root.querySelectorAll('.govuk-tabs__list-item').forEach((item) => {
          const selected = item.dataset.panelId === selectedId
          item.classList.toggle('govuk-tabs__list-item--selected', selected)
          const tab = item.querySelector('.govuk-tabs__tab')
          const label = tab.textContent
          if (selected) {
            const text = document.createElement('span')
            text.className = 'govuk-tabs__tab'
            text.setAttribute('aria-current', 'true')
            text.setAttribute('tabindex', '-1')
            text.textContent = label
            tab.replaceWith(text)
          } else if (tab.tagName === 'SPAN') {
            const nextLink = document.createElement('a')
            nextLink.className = 'govuk-tabs__tab'
            nextLink.href = `#${item.dataset.panelId}`
            nextLink.textContent = label
            tab.replaceWith(nextLink)
          }
          const panel = root.querySelector(`#${item.dataset.panelId}`)
          panel.hidden = !selected
        })
        root
          .querySelector('.govuk-tabs__list-item--selected .govuk-tabs__tab')
          .focus()
      })
  })
}
