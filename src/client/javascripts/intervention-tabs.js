const ROOT_SELECTOR = '.app-habitat-intervention-tabs'
const LIST_SELECTOR = '.govuk-tabs__list'
const ITEM_SELECTOR = '.govuk-tabs__list-item'
const TAB_CLASS = 'govuk-tabs__tab'
const TAB_SELECTOR = `.${TAB_CLASS}`
const SELECTED_ITEM_CLASS = 'govuk-tabs__list-item--selected'
const HIDDEN_PANEL_CLASS = 'govuk-tabs__panel--hidden'
const PANEL_ID_ATTR = 'data-panel-id'
const ARIA_CURRENT = 'aria-current'
const ARIA_CURRENT_VALUE = 'true'
const HASH_PREFIX = '#'
const SPAN_TAG = 'SPAN'
const ANCHOR_TAG = 'A'
const TABINDEX_ATTR = 'tabindex'
const NOT_IN_TAB_ORDER = '-1'

/**
 * The selected intervention tab is plain text, not a link. Inactive tabs
 * stay as in-page hash links. Clicking one swaps them so the newly
 * active label is no longer a hyperlink.
 */
export function initInterventionTabs() {
  const roots = document.querySelectorAll(ROOT_SELECTOR)
  for (const root of roots) {
    bindTabs(root)
  }
}

function bindTabs(root) {
  const list = root.querySelector(LIST_SELECTOR)
  if (!list) {
    return
  }

  list.addEventListener(
    'click',
    (event) => {
      onTabListClick(event, root)
    },
    true
  )
  window.addEventListener('hashchange', () => {
    syncFromHash(root)
  })

  syncFromHash(root)
}

function onTabListClick(event, root) {
  const item = listItemFromEvent(event, root)
  if (!item) {
    return
  }

  if (item.classList.contains(SELECTED_ITEM_CLASS)) {
    event.preventDefault()
    return
  }

  event.preventDefault()
  activateTab(root, item, true)
  rememberTab(item)
}

function listItemFromEvent(event, root) {
  const from = elementFromTarget(event.target)
  if (!from) {
    return null
  }

  const item = from.closest(ITEM_SELECTOR)
  if (item && root.contains(item)) {
    return item
  } else {
    return null
  }
}

function elementFromTarget(target) {
  if (target && typeof target.closest === 'function') {
    return target
  }

  const parent = target?.parentElement
  if (parent && typeof parent.closest === 'function') {
    return parent
  } else {
    return null
  }
}

function syncFromHash(root) {
  const hashedItem = itemForHash(root, window.location.hash)
  if (hashedItem && !hashedItem.classList.contains(SELECTED_ITEM_CLASS)) {
    activateTab(root, hashedItem)
  }
}

function itemForHash(root, hash) {
  const panelId = panelIdFromHash(hash)
  if (panelId) {
    return findItemByPanelId(root, panelId)
  } else {
    return null
  }
}

function panelIdFromHash(hash) {
  if (hash?.startsWith(HASH_PREFIX)) {
    return hash.slice(HASH_PREFIX.length)
  } else {
    return null
  }
}

function findItemByPanelId(root, panelId) {
  const items = root.querySelectorAll(ITEM_SELECTOR)
  for (const item of items) {
    if (item.getAttribute(PANEL_ID_ATTR) === panelId) {
      return item
    }
  }
  return null
}

function activateTab(root, selectedItem, moveFocus = false) {
  const items = root.querySelectorAll(ITEM_SELECTOR)
  for (const item of items) {
    const isSelected = item === selectedItem
    item.classList.toggle(SELECTED_ITEM_CLASS, isSelected)
    renderTabLabel(item, isSelected)
    const panel = panelForItem(root, item)
    if (panel) {
      if (isSelected) {
        panel.classList.remove(HIDDEN_PANEL_CLASS)
      } else {
        panel.classList.add(HIDDEN_PANEL_CLASS)
      }
    }
  }

  if (moveFocus) {
    focusSelectedTab(selectedItem)
  }
}

function focusSelectedTab(item) {
  const tab = item.querySelector(TAB_SELECTOR)
  if (tab) {
    tab.focus()
  }
}

function panelForItem(root, item) {
  const panelId = item.getAttribute(PANEL_ID_ATTR)
  if (panelId) {
    const panel = document.getElementById(panelId)
    if (panel && root.contains(panel)) {
      return panel
    } else {
      return null
    }
  } else {
    return null
  }
}

function renderTabLabel(item, isSelected) {
  const current = item.querySelector(TAB_SELECTOR)
  if (!current) {
    return
  }

  const label = current.textContent
  const panelId = item.getAttribute(PANEL_ID_ATTR) ?? ''

  if (isSelected) {
    replaceWithSpan(current, label)
  } else {
    replaceWithLink(current, label, panelId)
  }
}

function replaceWithSpan(current, label) {
  if (current.tagName === SPAN_TAG) {
    current.setAttribute(ARIA_CURRENT, ARIA_CURRENT_VALUE)
    current.setAttribute(TABINDEX_ATTR, NOT_IN_TAB_ORDER)
    return
  }

  const span = document.createElement('span')
  span.className = TAB_CLASS
  span.setAttribute(ARIA_CURRENT, ARIA_CURRENT_VALUE)
  span.setAttribute(TABINDEX_ATTR, NOT_IN_TAB_ORDER)
  span.textContent = label
  current.replaceWith(span)
}

function replaceWithLink(current, label, panelId) {
  if (current.tagName === ANCHOR_TAG) {
    current.removeAttribute(ARIA_CURRENT)
    return
  }

  const link = document.createElement('a')
  link.className = TAB_CLASS
  link.href = `${HASH_PREFIX}${panelId}`
  link.textContent = label
  current.replaceWith(link)
}

function rememberTab(item) {
  const panelId = item.getAttribute(PANEL_ID_ATTR)
  if (!panelId) {
    return
  }

  const panel = document.getElementById(panelId)
  if (!panel) {
    window.location.hash = panelId
    return
  }

  // Same trick as GOV.UK Tabs: drop the panel id so setting the hash
  // does not scroll the page, then put it back.
  panel.id = ''
  window.location.hash = panelId
  panel.id = panelId
}
