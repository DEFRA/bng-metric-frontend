import { warningAnnotations } from './annotations.mjs'
import { STATUS } from './rows.mjs'

const FILE = 'src/server/common/error-text/error-text.yaml'
const row = (id, status, line = 12) => ({
  id,
  status,
  source: `https://x/blob/abc/${FILE}#L${line}\nhttps://x/blob/abc/${FILE}#L90`
})

describe('warningAnnotations', () => {
  test('warns of a new error with no words, on its line', () => {
    expect(
      warningAnnotations([{ row: row('NEW_CODE', STATUS.NEEDS_CONTENT) }], FILE)
    ).toEqual([
      `::warning file=${FILE},line=12,title=Error wording needs content::New error NEW_CODE is Needs content. It has no words of its own yet, so the user sees a stand-in. UCD will need to word it.`
    ])
  })

  test('warns of an error whose status moves back', () => {
    const [annotation] = warningAnnotations(
      [
        {
          row: row('NO_REDLINE', STATUS.AWAITING_UCD, 526),
          before: STATUS.FINAL
        }
      ],
      FILE
    )
    expect(annotation).toBe(
      `::warning file=${FILE},line=526,title=Error wording awaiting UCD::NO_REDLINE moves from Final to Awaiting UCD. Its words, or those of the shared page it shows, are interim. UCD will need to review them.`
    )
  })

  test('leaves the line out when the row has no source link', () => {
    const [annotation] = warningAnnotations(
      [{ row: { id: 'A', status: STATUS.NEEDS_CONTENT } }],
      FILE
    )
    expect(annotation).toMatch(new RegExp(`^::warning file=${FILE},title=`))
  })

  test('escapes what would end the command or a property', () => {
    const [annotation] = warningAnnotations(
      [{ row: row('A%B\nC', STATUS.NEEDS_CONTENT) }],
      'a:b,c.yaml'
    )
    expect(annotation).toMatch(/^::warning file=a%3Ab%2Cc\.yaml,line=12,/)
    expect(annotation).toContain('New error A%25B%0AC is')
    expect(annotation.split('\n')).toHaveLength(1)
  })

  test('gives nothing for no changes', () => {
    expect(warningAnnotations([], FILE)).toEqual([])
  })

  test('gives one for each of 10 changes', () => {
    const changes = Array.from({ length: 10 }, (_, i) => ({
      row: row(`CODE_${i}`, STATUS.AWAITING_UCD, i + 1)
    }))
    const annotations = warningAnnotations(changes, FILE)
    expect(annotations).toHaveLength(10)
    expect(annotations.at(-1)).toContain('New error CODE_9 is')
  })

  test('past 10, gives 9 and says how many more, as GitHub keeps only 10', () => {
    const changes = Array.from({ length: 11 }, (_, i) => ({
      row: row(`CODE_${i}`, STATUS.AWAITING_UCD, i + 1)
    }))
    const annotations = warningAnnotations(changes, FILE)
    expect(annotations).toHaveLength(10)
    expect(annotations[8]).toContain('New error CODE_8 is')
    expect(annotations[9]).toBe(
      "::warning title=More error wording left unfinished::2 more entries are left unfinished. The run's summary and log list every change."
    )
  })
})
