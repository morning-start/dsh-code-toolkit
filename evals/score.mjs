#!/usr/bin/env node
/**
 * Score one model reply against a case's expected findings.
 *
 *   node evals/score.mjs --case 01-null-header --report run/report.txt
 *
 * Review cases are scored on the parsed report, so the number reflects what the
 * user would actually see, not what the model meant. Simplify cases are scored
 * on required content groups in the plan.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseReport } from '../src/report.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const caseName = arg('case')
const reportPath = arg('report')
const asJson = process.argv.includes('--json')

if (!caseName || !reportPath) {
  console.error('usage: node evals/score.mjs --case <case> --report <file> [--json]')
  process.exit(2)
}

const expected = JSON.parse(readFileSync(join(ROOT, 'evals', 'cases', caseName, 'expected.json'), 'utf8'))
const raw = readFileSync(reportPath, 'utf8')

const normalize = (value) => String(value ?? '').replaceAll('\\', '/').toLowerCase()

function matches(reported, want) {
  if (!normalize(reported.path).endsWith(normalize(want.file))) return false
  const tolerance = want.lineTolerance ?? 2
  const from = want.line - tolerance
  const to = want.line + tolerance
  const start = reported.start || reported.end || 0
  const end = reported.end || reported.start || 0
  if (!start && !end) return false
  return start <= to && end >= from
}

function scoreReview() {
  const report = parseReport(raw)
  const reported = report.findings ?? []
  const used = new Set()
  const hits = []

  for (const want of expected.findings ?? []) {
    const index = reported.findIndex((item, position) => !used.has(position) && matches(item, want))
    if (index === -1) {
      hits.push({ id: want.id, found: false })
      continue
    }
    used.add(index)
    const found = reported[index]
    const priorityOff = found.priority === null ? null : Math.abs(found.priority - want.priority)
    hits.push({ id: want.id, found: true, priority: found.priority, priorityOff })
  }

  const expectedCount = (expected.findings ?? []).length
  const foundCount = hits.filter((hit) => hit.found).length
  const extra = reported.length - used.size
  const recall = expectedCount ? foundCount / expectedCount : 1
  const precision = reported.length ? (reported.length - extra) / reported.length : 1
  const priorityOk = hits.filter((hit) => hit.found && (hit.priorityOff === null || hit.priorityOff <= 1)).length

  const cleanPass = expected.clean ? reported.length === 0 : true
  // A scrub report that repeats the secret has only moved the leak.
  const leaks = (expected.mustNotLeak ?? []).filter((needle) => raw.includes(needle))
  const pass =
    recall === 1 &&
    extra <= (expected.allowedExtras ?? 0) &&
    cleanPass &&
    leaks.length === 0 &&
    (expected.clean ? true : priorityOk === expectedCount)

  return {
    case: caseName,
    mode: expected.mode,
    pass,
    format: report.format,
    expected: expectedCount,
    found: foundCount,
    reported: reported.length,
    extra,
    recall,
    precision,
    priorityOk,
    hits,
    cleanPass,
    leaks: leaks.length,
  }
}

function scoreGroups(mode) {
  const text = raw.toLowerCase()
  const groups = (expected.requireGroups ?? []).map((group) => ({
    any: group,
    hit: group.some((needle) => text.includes(needle.toLowerCase())),
  }))
  const forbidden = (expected.forbid ?? []).filter((needle) => text.includes(needle.toLowerCase()))
  const pass = groups.every((group) => group.hit) && forbidden.length === 0
  return { case: caseName, mode, pass, groups, forbidden }
}

const result = ['simplify', 'caption', 'pua'].includes(expected.mode) ? scoreGroups(expected.mode) : scoreReview()

if (asJson) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`case ${result.case} (${result.mode}) → ${result.pass ? 'PASS' : 'FAIL'}`)
  if (Array.isArray(result.groups)) {
    for (const group of result.groups) console.log(`  ${group.hit ? '✓' : '✗'} ${group.any.join(' | ')}`)
    if (result.forbidden.length) console.log(`  ✗ forbidden: ${result.forbidden.join(', ')}`)
  } else {
    console.log(`  format=${result.format} recall=${result.recall.toFixed(2)} precision=${result.precision.toFixed(2)} extra=${result.extra} priorityOk=${result.priorityOk}/${result.expected}${result.leaks ? ` LEAKED=${result.leaks}` : ''}`)
    for (const hit of result.hits) {
      console.log(`  ${hit.found ? '✓' : '✗'} ${hit.id}${hit.found ? ` (P${hit.priority}, off by ${hit.priorityOff ?? 'n/a'})` : ''}`)
    }
  }
}

process.exit(result.pass ? 0 : 1)
