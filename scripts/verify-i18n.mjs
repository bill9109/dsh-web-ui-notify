#!/usr/bin/env node
// Bilingual-pair consistency check for README.md / README.zh.md.
// Usage:
//   node scripts/verify-i18n.mjs          # verify recorded hashes match
//   node scripts/verify-i18n.mjs --write  # re-record current hashes
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const recordPath = join(root, 'README.i18n.yaml')
const files = ['README.md', 'README.zh.md']
const write = process.argv.includes('--write')

function blobHash(rel) {
  // git hash-object <file> -> git blob sha1, independent of working tree
  return execFileSync('git', ['hash-object', join(root, rel)], { encoding: 'utf8' }).trim()
}

function readRecord() {
  const out = {}
  for (const line of readFileSync(recordPath, 'utf8').split('\n')) {
    const m = /^README(?:\.zh)?\.md:\s+([0-9a-f]{40})$/.exec(line.trim())
    if (m) out[line.trim().split(':')[0]] = m[1]
  }
  return out
}

const current = Object.fromEntries(files.map((f) => [f, blobHash(f)]))
const recorded = readRecord()

if (write) {
  const lines = readFileSync(recordPath, 'utf8').split('\n').map((line) => {
    const key = line.trim().split(':')[0]
    return current[key] ? `${key}: ${current[key]}` : line
  })
  writeFileSync(recordPath, lines.join('\n'))
  console.log('updated README.i18n.yaml')
  for (const f of files) console.log(`  ${f}: ${current[f]}`)
  process.exit(0)
}

let ok = true
for (const f of files) {
  const got = current[f]
  const want = recorded[f]
  const match = got === want
  ok &&= match
  console.log(`${match ? 'OK ' : 'DIFF'} ${f}`)
  if (!match) console.log(`     recorded ${want}\n     current  ${got}`)
}
if (!ok) {
  console.error('\nREADME.md / README.zh.md drifted; update the other language and run:')
  console.error('  node scripts/verify-i18n.mjs --write')
  process.exit(1)
}
console.log('\nREADME bilingual pair is consistent.')
