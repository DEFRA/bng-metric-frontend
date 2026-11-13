import { LineCounter, isMap, parseDocument } from 'yaml'

// error-text.yaml as the export reads it: its values, and the line each entry
// starts on, for a link to it. js-yaml, which the service reads the file
// with, does not keep lines.

/** The key and value at `path`, or null when the file has none there. */
function pairAt(doc, path) {
  let node = doc.contents
  let pair = null
  for (const key of path) {
    if (!isMap(node)) {
      return null
    }
    pair = node.items.find((item) => item.key?.value === key)
    if (!pair) {
      return null
    }
    node = pair.value
  }
  return pair
}

/**
 * Read error-text.yaml's text.
 *
 * @param {string} source - YAML text
 * @returns {{
 *   value: Record<string, any>,
 *   lineOf: (path: string[]) => number | undefined
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
      const pair = pairAt(doc, path)
      return pair ? lineCounter.linePos(pair.key.range[0]).line : undefined
    }
  }
}
