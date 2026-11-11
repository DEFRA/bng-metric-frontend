import { LineCounter, isMap, isPair, isSeq, parseDocument } from 'yaml'

// error-text.yaml as the export reads it: its values, the line each entry
// starts on, for a link to it, and the comments written beside it, which
// explain an entry to whoever reviews its wording. js-yaml, which the service
// reads the file with, keeps neither lines nor comments.

// A comment parted from the key below it by a blank line, or opened by a rule
// of dashes, heads a group of entries rather than describing one.
const RULE = /^\s*-{3,}/

function isGroupComment(comment) {
  return comment.endsWith('\n') || RULE.test(comment)
}

/** A comment's lines as sentences: one paragraph a line, blank lines kept. */
function tidy(comment) {
  return comment
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replaceAll('\n', ' '))
    .join('\n')
}

/** The pair at `path`, the map holding it, and its place in that map. */
function pairAt(doc, path) {
  let node = doc.contents
  let found = null
  for (const key of path) {
    if (!isMap(node)) {
      return null
    }
    const index = node.items.findIndex((pair) => pair.key?.value === key)
    if (index === -1) {
      return null
    }
    found = { pair: node.items[index], map: node, index }
    node = found.pair.value
  }
  return found
}

/** Every comment written before a key or an item anywhere under `node`. */
function commentsUnder(node) {
  if (isPair(node)) {
    return [node.key?.commentBefore, ...commentsUnder(node.value)]
  }
  if (isMap(node) || isSeq(node)) {
    return [node.commentBefore, ...node.items.flatMap(commentsUnder)]
  }
  return [node?.commentBefore]
}

/**
 * Read error-text.yaml's text.
 *
 * @param {string} source - YAML text
 * @returns {{
 *   value: Record<string, any>,
 *   lineOf: (path: string[]) => number | undefined,
 *   commentsOf: (path: string[]) => string
 * }}
 */
export function readErrorTextSource(source) {
  const lineCounter = new LineCounter()
  const doc = parseDocument(source, { lineCounter })
  if (doc.errors.length > 0) {
    throw new Error(
      `error-text.yaml is not valid YAML: ${doc.errors[0].message}`
    )
  }

  return {
    value: doc.toJS(),

    /** The line the entry at `path` starts on, counting from 1. */
    lineOf(path) {
      const found = pairAt(doc, path)
      return found
        ? lineCounter.linePos(found.pair.key.range[0]).line
        : undefined
    },

    /**
     * The comments that describe the entry at `path`: above its key, and
     * inside it. A first key's comment is held by the map it opens.
     */
    commentsOf(path) {
      const found = pairAt(doc, path)
      if (!found) {
        return ''
      }
      const above = found.index === 0 ? [found.map.commentBefore] : []
      return [...above, ...commentsUnder(found.pair)]
        .filter((comment) => comment && !isGroupComment(comment))
        .map(tidy)
        .join('\n')
    }
  }
}
