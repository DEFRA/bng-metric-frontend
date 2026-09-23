import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { compile, NodePackageImporter } from 'sass-embedded'

// BMD-983: visited links must not change appearance site-wide. This can only
// be guarded at the stylesheet level — Playwright's bundled Chromium never
// populates the visited-link database, so a rendered `:visited` test passes
// vacuously. Here we compile the real stylesheet and resolve the winning
// `:visited` colour for each element by CSS cascade rules (specificity, then
// source order), so a regression in `_links.scss` (or a GOV.UK upgrade that
// reorders/retitles the base rules) fails this suite instead of shipping.

const thisDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(thisDir, '..', '..', '..', '..')

const LINK = '#1a65a6' // --govuk-link-colour (unvisited)
const VISITED = '#54319f' // --govuk-link-visited-colour (purple)
const MUTED = '#484949' // --govuk-secondary-text-colour
const TEXT = '#0b0c0c' // --govuk-text-colour
const INVERSE = '#ffffff' // --govuk-inverse-text-colour

const STATE_PSEUDOS = new Set([
  ':visited',
  ':link',
  ':active',
  ':hover',
  ':focus'
])

/** Parse a compiled compound selector into tag/classes/:not args/pseudos. */
function parseCompound(compound) {
  const nots = []
  const withoutNots = compound.replace(/:not\(([^)]*)\)/g, (_, inner) => {
    nots.push(inner.split(',').map((s) => s.trim()))
    return ''
  })
  const tag = /^[a-z]+/.exec(withoutNots)?.[0] ?? null
  const classes = new Set(
    [...withoutNots.matchAll(/\.([\w-]+)/g)].map((m) => m[1])
  )
  const pseudos = [...withoutNots.matchAll(/:[\w-]+/g)].map((m) => m[0])
  return { tag, classes, nots, pseudos }
}

/** Does a simple selector (a `:not` argument or ancestor part) match el? */
function matchesSimple(selector, el) {
  const { tag, classes } = parseCompound(selector)
  if (tag && tag !== el.tag) {
    return false
  }
  return [...classes].every((c) => el.classes.has(c))
}

/** Does a key compound (final part) match el, in the `:visited` state? */
function matchesKey(compound, el) {
  const { tag, classes, nots, pseudos } = parseCompound(compound)
  if (!pseudos.includes(':visited')) {
    return false
  }
  if (tag && tag !== el.tag) {
    return false
  }
  if (![...classes].every((c) => el.classes.has(c))) {
    return false
  }
  return !nots.some((argList) => argList.some((arg) => matchesSimple(arg, el)))
}

/** Split a complex selector on descendant combinators, ignoring paren spaces. */
function splitParts(selector) {
  const parts = []
  let depth = 0
  let current = ''
  for (const ch of selector.trim()) {
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
    }
    if (/\s/.test(ch) && depth === 0) {
      if (current) {
        parts.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current) {
    parts.push(current)
  }
  return parts
}

/** [ids, classes+pseudo-classes+:not, elements] for a full selector. */
function specificity(selector) {
  const parts = splitParts(selector)
  const total = [0, 0, 0]
  for (const part of parts) {
    const { tag, classes, nots, pseudos } = parseCompound(part)
    total[1] += classes.size
    total[1] += pseudos.filter((p) => STATE_PSEUDOS.has(p)).length
    total[1] += nots.length // each :not arg list here contributes one class
    if (tag) {
      total[2] += 1
    }
  }
  return total
}

function moreSpecific(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) {
      return a[i] > b[i]
    }
  }
  return false
}

/** Split a selector group on top-level commas, ignoring those inside :not(). */
function splitSelectorGroup(group) {
  const selectors = []
  let depth = 0
  let current = ''
  for (const ch of group) {
    if (ch === '(') {
      depth++
    } else if (ch === ')') {
      depth--
    }
    if (ch === ',' && depth === 0) {
      selectors.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  selectors.push(current)
  return selectors
}

/** Split "a, b { color: c }" blocks into ordered {selector, color} rules. */
function parseRules(css) {
  const rules = []
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const colorDecls = [...match[2].matchAll(/(?:^|[;{\s])color:\s*([^;]+);/g)]
    if (colorDecls.length === 0) {
      continue
    }
    const raw = colorDecls.at(-1)[1].trim()
    const color = /#[0-9a-f]{6}/i.exec(raw)?.[0] ?? raw
    for (const selector of splitSelectorGroup(match[1])) {
      rules.push({ selector: selector.trim(), color })
    }
  }
  return rules
}

/**
 * Resolve the colour a visited element renders, applying the cascade.
 * @param {{tag: string, classes: string[], ancestors?: string[][]}} el
 */
function resolveVisitedColor(rules, el) {
  const element = {
    tag: el.tag,
    classes: new Set(el.classes),
    ancestors: (el.ancestors ?? []).map((a) => new Set(a))
  }
  let winner = null
  let winningSpec = null
  rules.forEach(({ selector, color }, order) => {
    const parts = splitParts(selector)
    const key = parts.at(-1)
    if (!matchesKey(key, element)) {
      return
    }
    // Every ancestor part must be satisfied by some ancestor's classes.
    const ancestorsOk = parts.slice(0, -1).every((anc) => {
      const { classes } = parseCompound(anc)
      return element.ancestors.some((set) =>
        [...classes].every((c) => set.has(c))
      )
    })
    if (!ancestorsOk) {
      return
    }
    const spec = specificity(selector)
    if (
      winner === null ||
      moreSpecific(spec, winningSpec) ||
      (!moreSpecific(winningSpec, spec) && order > winner.order)
    ) {
      winner = { color, order }
      winningSpec = spec
    }
  })
  return winner?.color ?? null
}

describe('BMD-983 visited-link stylesheet', () => {
  let rules

  beforeAll(() => {
    const { css } = compile(join(thisDir, '_links.scss'), {
      loadPaths: [
        join(repoRoot, 'src/client/stylesheets'),
        join(repoRoot, 'src/server/common/components'),
        join(repoRoot, 'src/server/common/templates/partials')
      ],
      importers: [new NodePackageImporter(repoRoot)],
      quietDeps: true
    })
    rules = parseRules(css)
  })

  it('keeps standard content links link-coloured once visited (R1)', () => {
    expect(
      resolveVisitedColor(rules, { tag: 'a', classes: ['govuk-link'] })
    ).toBe(LINK)
  })

  it('keeps footer links link-coloured once visited (R1)', () => {
    expect(
      resolveVisitedColor(rules, { tag: 'a', classes: ['govuk-footer__link'] })
    ).toBe(LINK)
  })

  it('keeps tabs link-coloured once visited without JavaScript (R1)', () => {
    expect(
      resolveVisitedColor(rules, { tag: 'a', classes: ['govuk-tabs__tab'] })
    ).toBe(LINK)
  })

  it('leaves JavaScript-enhanced tabs at their text colour', () => {
    expect(
      resolveVisitedColor(rules, {
        tag: 'a',
        classes: ['govuk-tabs__tab'],
        ancestors: [['govuk-frontend-supported']]
      })
    ).toBe(TEXT)
  })

  it('covers bare anchors so future pages inherit the default (R2)', () => {
    expect(resolveVisitedColor(rules, { tag: 'a', classes: [] })).toBe(LINK)
    expect(resolveVisitedColor(rules, { tag: 'a', classes: [] })).not.toBe(
      VISITED
    )
  })

  it('does not repaint the deliberate colour-modifier links', () => {
    expect(
      resolveVisitedColor(rules, {
        tag: 'a',
        classes: ['govuk-link', 'govuk-link--muted']
      })
    ).toBe(MUTED)
    expect(
      resolveVisitedColor(rules, {
        tag: 'a',
        classes: ['govuk-link', 'govuk-link--text-colour']
      })
    ).toBe(TEXT)
    expect(
      resolveVisitedColor(rules, {
        tag: 'a',
        classes: ['govuk-link', 'govuk-link--inverse']
      })
    ).toBe(INVERSE)
  })
})
