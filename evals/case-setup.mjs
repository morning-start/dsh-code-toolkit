#!/usr/bin/env node
/**
 * Materialise a case into a throwaway git repository so the agent has something
 * real to review.
 *
 *   node evals/case-setup.mjs --case 01-null-header --out tmp/case-01
 *
 * Layout produced:
 *   <out>/            before/ committed on main
 *   <out>/*           after/ copied over, left uncommitted
 *
 * For a simplify case there is no after/, so the tree is clean and the scope is
 * a path instead of a diff.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

function arg(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const caseName = arg('case')
const out = arg('out')
if (!caseName || !out) {
  console.error('usage: node evals/case-setup.mjs --case <case> --out <dir>')
  process.exit(2)
}

const caseDir = join(ROOT, 'evals', 'cases', caseName)
if (!existsSync(caseDir)) {
  console.error(`no such case: ${caseName}`)
  process.exit(2)
}

const target = join(ROOT, out)
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })

function copyTree(from, to) {
  for (const entry of readdirSync(from)) {
    const source = join(from, entry)
    const destination = join(to, entry)
    if (statSync(source).isDirectory()) {
      mkdirSync(destination, { recursive: true })
      copyTree(source, destination)
    } else {
      cpSync(source, destination)
    }
  }
}

copyTree(join(caseDir, 'before'), target)

const git = (...args) =>
  execFileSync('git', args, {
    cwd: target,
    stdio: 'pipe',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).toString().trim()

git('init', '-q', '-b', 'main')
git('config', 'user.email', 'eval@local')
git('config', 'user.name', 'eval')
git('add', '-A')
git('commit', '-q', '-m', 'base')

const afterDir = join(caseDir, 'after')
const sources = [...new Set(
  readdirSync(join(caseDir, 'before'), { recursive: true })
    .map((entry) => String(entry).replaceAll('\\', '/'))
    .filter((entry) => entry.endsWith('.js')),
)].sort()

if (existsSync(afterDir)) {
  copyTree(afterDir, target)
  console.log(`case ${caseName} → ${target} (uncommitted change on top of base)`)
  console.log(`  review with: --files ${sources.join(',')}`)
} else {
  console.log(`case ${caseName} → ${target} (clean tree; simplify against a path)`)
  console.log(`  simplify with: --files ${sources.join(',')}`)
}
console.log(`  diff: git -C "${target}" diff`)
