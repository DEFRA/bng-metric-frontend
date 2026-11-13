// The [link text](target) error-text.yaml's wording can hold. A message is
// split at its link before its {values} are filled in, so a value from a
// customer's file or answer that holds "[" or "](" cannot move the link.

const LINK_OPEN = '['
const LINK_MIDDLE = ']('
const LINK_CLOSE = ')'

/**
 * Split a sentence at its [link text](target), or return it whole as
 * `before` when it has none.
 *
 * @param {string} sentence
 * @returns {{ before: string, linkText?: string, target?: string, after?: string }}
 */
export function splitLink(sentence) {
  const open = sentence.indexOf(LINK_OPEN)
  const middle = open === -1 ? -1 : sentence.indexOf(LINK_MIDDLE, open)
  const close = middle === -1 ? -1 : sentence.indexOf(LINK_CLOSE, middle)
  if (close === -1) {
    return { before: sentence }
  }
  return {
    before: sentence.slice(0, open),
    linkText: sentence.slice(open + LINK_OPEN.length, middle),
    target: sentence.slice(middle + LINK_MIDDLE.length, close),
    after: sentence.slice(close + LINK_CLOSE.length)
  }
}
