// Fails at the source PR when a file the toolkit importer copies holds private wording, so the
// refusal does not wait for re-import (handoff-css #76 fixed 17 such references found at re-import).
//
// Two things are copied from the figma-agent-handoff-toolkit repo and must be kept in step by hand:
//  1. The file set. The importer (scripts/import-sources.sh, toolkit commit 8790e16) copies the
//     `npm pack` file list minus the paths below; this test derives its list the same way.
//  2. The word hashes and patterns (scripts/public-check.mjs, toolkit commit 8790e16). Words are
//     held as the first 16 hex characters of sha256(lowercase word); no word appears here in clear.
//     The importer also trims package.json (presets/fixtures entries); trimmedPackageJson repeats that.
//     When the toolkit list changes, copy the new hashes here and bump the commit named above.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Same filter as import-sources.sh: drops these paths from the npm pack list.
const NOT_COPIED = [/^(presets|fixtures)\//, /hosts\/claude-plugin|dist\/claude-plugin/]

const PRIVATE_WORDS = new Set([
  'c6cfcd45633db6b1', 'dada1e22ba81d0c1', 'e6f0a1fbb43c8919', '0e6a8e0b849ed9b0',
  'f649ee2eba9adbee', '06538a134a442a35', '06e55b633481f7bb', 'f281d6aaaf9ef82f',
  'bb30aee1f283d4fa', 'b0e2cce4d295165a', '83c6562a5514fc70', '670d47ccb9a6cdef',
])
// Public on purpose: two generated phrases the tools print (toolkit public-check ALLOWED_PHRASES).
const ALLOWED_PHRASES = [/Open questions for the operator/g, /operator-authored contract/g]
const OWNER = 'mrjarrad' // the repo owner's account name is part of its public address
const PATTERNS = [
  ['local path', /\/Users\/|~\/[A-Z]{2,}\//],
  ['tracker id', /\b(HT|PF|DISC|HB)-\d+\b/],
  ['session id', /\bsession_0[0-9A-Za-z]{8,}/],
  ['private storage', /\b(the|to|from) Drop\b|\bthe Mac\b/],
  ['private repo', /MrJarrad\/(?!figma-agent-handoff-toolkit\b)/],
  ['private host', /\b[\w-]+\.workers\.dev\b/i],
]
// A word glued inside a longer one is caught by hashing each 3 to 24 letter run in words up to 40 long.
const GLUED_MIN = 3, GLUED_MAX = 24, GLUED_WORD_MAX = 40

const hashWord = (word) => createHash('sha256').update(word.toLowerCase()).digest('hex').slice(0, 16)

/** Findings ("file:line kind") in one text. */
export function findPrivate(file, text, words = PRIVATE_WORDS) {
  const out = []
  const part = (word) => {
    const lower = word.toLowerCase()
    if (lower === OWNER) return null
    if (words.has(hashWord(lower))) return 'private word'
    if (lower.length > GLUED_WORD_MAX) return null
    for (let size = Math.min(GLUED_MAX, lower.length - 1); size >= GLUED_MIN; size -= 1)
      for (let at = 0; at + size <= lower.length; at += 1)
        if (words.has(hashWord(lower.slice(at, at + size)))) return 'private word inside a word'
    return null
  }
  text.split('\n').forEach((raw, i) => {
    const line = ALLOWED_PHRASES.reduce((rest, allowed) => rest.replace(allowed, ''), raw)
    for (const word of line.match(/[A-Za-z0-9]+/g) ?? []) {
      const kind = part(word)
      if (kind) out.push(`${file}:${i + 1} ${kind}`)
    }
    for (const [kind, pattern] of PATTERNS) if (pattern.test(line)) out.push(`${file}:${i + 1} ${kind}`)
  })
  return out
}

/** package.json as the importer leaves it: preset exports and preset/fixture files removed. */
function trimmedPackageJson(text) {
  const j = JSON.parse(text)
  for (const k of Object.keys(j.exports)) if (k.startsWith('./presets/')) delete j.exports[k]
  j.files = j.files.filter((f) => !/^(presets|fixtures)(\/|$)/.test(f))
  return JSON.stringify(j, null, 2) + '\n'
}

const copiedFiles = () =>
  JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))[0]
    .files.map((f) => f.path).filter((p) => !NOT_COPIED.some((re) => re.test(p)))

test('no file the toolkit importer copies holds private wording', () => {
  const files = copiedFiles()
  assert.ok(files.length > 20 && files.includes('package.json'), 'file list derived from npm pack')
  const read = (f) => { const t = readFileSync(path.join(root, f), 'utf8'); return f === 'package.json' ? trimmedPackageJson(t) : t }
  const findings = files.flatMap((f) => findPrivate(f, read(f)))
  assert.deepEqual(findings, [])
})

test('the check catches each kind (made-up word; text assembled at run time)', () => {
  const words = new Set([hashWord('zorblax')])
  const j = (...p) => p.join('')
  assert.deepEqual(findPrivate('a', 'Ask Zorblax.', words), ['a:1 private word'])
  assert.deepEqual(findPrivate('a', 'mailtozorblax@x.com', words), ['a:1 private word inside a word'])
  for (const text of [j('~', '/WORK/x'), j('H', 'T-27'), j('sess', 'ion_019abcdefghijkl'), j('to the D', 'rop'), j('MrJar', 'rad/other'), j('a.work', 'ers.dev')])
    assert.equal(findPrivate('a', text, words).length, 1, text)
  assert.deepEqual(findPrivate('a', 'clean text, MrJarrad/figma-agent-handoff-toolkit', words), [])
})
