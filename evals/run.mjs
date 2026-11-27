#!/usr/bin/env node
/**
 * Deterministic eval suite.
 *
 * Everything here is a property of the plugin's own files and code: prompt-tree
 * integrity, the report parser, the renderer, prompt assembly, package
 * metadata. No model is called, so it runs in a second and can gate a commit.
 *
 * The model's quality is measured by `evals/ACCEPTANCE.md` instead — see
 * `score.mjs` for the scoring half.
 */

import { readFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseReport, renderReport } from '../src/report.js'
import { scopeInstruction, scopeLabel, parseArgs, mergeBase, splitFlags, selectScope, resolveScope, scopeHasChanges, branchList } from '../src/selection.js'
import { reportMessage, failureMessage, userMessage } from '../src/delivery.js'
import { resolveLocale, translate, outputLanguage } from '../src/i18n.js'
import { sessionKey } from '../src/identity.js'
import { runIsolatedAgent } from '../src/runtime.js'
import { apply, name as pluginName } from '../index.js'
import { Journal } from '../src/journal.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const verbose = process.argv.includes('--verbose')

let passed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed += 1
    if (verbose) console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function testAsync(name, fn) {
  try {
    await fn()
    passed += 1
    if (verbose) console.log(`ok   ${name}`)
  } catch (error) {
    failures.push({ name, message: error instanceof Error ? error.message : String(error) })
    console.log(`FAIL ${name}\n     ${error instanceof Error ? error.message : String(error)}`)
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function assertThrows(fn, pattern, label) {
  try {
    fn()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!pattern.test(message)) throw new Error(`${label}: threw "${message}", expected it to match ${pattern}`)
    return
  }
  throw new Error(`${label}: did not throw`)
}

/**
 * The host validates a `user/message` session event by its message shape: a
 * non-empty string id, the role the event type expects, a source kind, and a
 * content array. Handing `steer` a partial `{ content, source }` writes a log
 * entry that fails on the next load with "lacks an identified message", which
 * permanently blocks the conversation from opening.
 */
function assertUserMessage(message, label) {
  assert(message && typeof message === 'object', `${label}: a message object`)
  assert(typeof message.id === 'string' && message.id.length > 0, `${label}: a non-empty string id`)
  assertEqual(message.role, 'user', `${label}: role`)
  assert(typeof message.source?.kind === 'string' && message.source.kind.length > 0, `${label}: a source kind`)
  assert(Array.isArray(message.content), `${label}: a content array`)
  assertEqual(message.content[0]?.type, 'text', `${label}: a text block`)
}

const read = (relative) => readFileSync(join(ROOT, relative), 'utf8')
const exists = (relative) => existsSync(join(ROOT, relative))
const t = (key) => translate('en', key)

// ---------------------------------------------------------------------------
// A. package metadata
// ---------------------------------------------------------------------------

test('package.json is valid and declares the bundle patch', () => {
  const pkg = JSON.parse(read('package.json'))
  assertEqual(pkg.type, 'module', 'type')
  assertEqual(pkg.dsh?.bundle?.patch, './cordis.patch.yml', 'dsh.bundle.patch')
  assert(Boolean(pkg.engines?.dsh), 'engines.dsh is required for a bundle')
  assert(pkg.files.includes('agents'), 'files must ship agents/')
  assert(!pkg.files.includes('prompts'), 'the flat prompts/ directory is gone')
})

test('every declared file and export exists', () => {
  const pkg = JSON.parse(read('package.json'))
  for (const entry of pkg.files) {
    if (entry.includes('*')) continue
    assert(exists(entry), `files entry missing: ${entry}`)
  }
  for (const target of Object.values(pkg.exports)) {
    if (typeof target !== 'string' || target.includes('*')) continue
    assert(exists(target), `export target missing: ${target}`)
  }
  for (const locale of ['zh', 'en']) {
    assert(exists(`locale/${locale}.json`), `locale/${locale}.json missing`)
  }
})

test('bundle patch inserts this package', () => {
  const pkg = JSON.parse(read('package.json'))
  const patch = read('cordis.patch.yml')
  assert(/^-\s+insert:/m.test(patch), 'patch needs an insert block')
  assert(patch.includes(pkg.name), `patch must name ${pkg.name}`)
})

test('plugin id agrees across package.json, the patch, and index.js', () => {
  const pkg = JSON.parse(read('package.json'))
  const patch = read('cordis.patch.yml')
  const patchName = patch.match(/^\s*name:\s*'([^']+)'/m)?.[1]
  const patchId = patch.match(/^\s*-\s+id:\s*(\S+)/m)?.[1]
  assertEqual(patchName, pkg.name, 'patch name must be the package name')
  assertEqual(patchId, pluginName, 'patch id must equal the exported module name')
})

test('the dsh block declares only fields the host reads', () => {
  const pkg = JSON.parse(read('package.json'))
  // The Loader reads `dsh.bundle.patch` (and optionally `dsh.bundle.platforms`).
  // `dsh.manifestVersion` is not a field the host ever looks at, so declaring it
  // reads as a schema the plugin invented for itself.
  assertEqual(Object.keys(pkg.dsh ?? {}).length, 1, 'dsh holds only bundle')
  assertEqual(Object.keys(pkg.dsh.bundle).length, 1, 'bundle holds only patch')
  assert(!('manifestVersion' in (pkg.dsh ?? {})), 'no invented manifestVersion')
})

test('market.json is a well-formed marketplace draft', () => {
  const market = JSON.parse(read('market.json'))
  assert(typeof market.category === 'string' && market.category.length > 0, 'a category id')
  for (const [lang, value] of Object.entries(market.title ?? {})) {
    assert(typeof value === 'string' && value.length > 0, `title.${lang} is a non-empty string`)
  }
  for (const [lang, value] of Object.entries(market.description ?? {})) {
    assert(typeof value === 'string' && value.length > 0, `description.${lang} is a non-empty string`)
  }
  assert(market.title?.en && market.title?.zh, 'title carries both languages')
  assert(market.description?.en && market.description?.zh, 'description carries both languages')
  assert(Array.isArray(market.keywords) && market.keywords.length > 0, 'keywords is a non-empty array')
  // A note is prose for the author, not a field the marketplace reads.
  assert(!('_note' in market), 'no author note masquerading as a field')
})

test('the old package name survives only in the changelog', () => {
  const stale = /code-quality|代码质量/
  const offenders = []
  const scan = (relative) => {
    if (stale.test(read(relative))) offenders.push(relative)
  }
  for (const file of ['package.json', 'cordis.patch.yml', 'README.md', 'AGENTS.md', 'index.js']) scan(file)
  for (const dir of ['src', 'agents', 'locale']) {
    for (const entry of readdirSync(join(ROOT, dir), { recursive: true })) {
      const relative = join(dir, entry).replaceAll('\\', '/')
      if (statSync(join(ROOT, relative)).isFile()) scan(relative)
    }
  }
  assert(offenders.length === 0, `still mentions the old name: ${offenders.join(', ')}`)
})

test('locale metadata carries a title and a description', () => {
  for (const locale of ['zh', 'en']) {
    const data = JSON.parse(read(`locale/${locale}.json`))
    assert(Boolean(data.meta?.title), `${locale}: title`)
    assert(Boolean(data.meta?.description), `${locale}: description`)
    // The detail page falls back to the README: the host renders a detail
    // document's Markdown without images, so a single-image document shows only
    // its alt text. Declaring one would make the page emptier, not richer.
    assertEqual(data.meta.detail, undefined, `${locale}: no detail document`)
  }
})

test('the README is what the detail page shows', () => {
  const readme = read('README.md')
  assert(readme.includes('# @morning-start/dsh-code-toolkit'), 'the README names the package')
  assert(readme.includes('/code-review'), 'and documents the commands')
  assert(!readme.includes('docs/DETAIL'), 'no dangling reference to a removed detail document')
})

test('the icon follows the 36x36 spec and draws no tile', () => {
  const icon = read('icon.svg')
  assert(icon.includes('width="36"') && icon.includes('height="36"'), 'the spec size')
  assert(icon.includes('viewBox="0 0 36 36"'), 'the matching viewBox')
  assert(!icon.includes('<rect width="36"'), 'Plugin Manager draws the tile, not the icon')
  assert(!icon.includes('<text'), 'lettering is drawn as paths')
  assert((statSync('icon.svg').size) <= 256 * 1024, 'icons stay under 256 KiB')
})

test('icon is self-contained svg', () => {
  const icon = read('icon.svg')
  assert(icon.includes('<svg') && icon.includes('</svg>'), 'icon must be svg')
  assert(/viewBox="[^"]+"/.test(icon), 'icon needs a viewBox')
  assert(!icon.includes('<script'), 'icon must not script')
  assert(!/https?:\/\//.test(icon.replace(/xmlns="[^"]*"/g, '')), 'icon must not fetch remote assets')
})

// ---------------------------------------------------------------------------
// B. prompt tree
// ---------------------------------------------------------------------------

const ROLES = {
  review: ['Resolve the scope', 'The eight gates', 'Priorities', 'Output', 'Reference files'],
  simplify: ['Three iron rules', 'Six operations', 'Anti-patterns', 'Verification', 'Reference files'],
  caption: ['The loop', 'Read the ledger first', 'Verify', 'Record one caption entry', 'Reference files'],
  pua: ['Three red lines', 'Pressure escalation', 'The five steps', 'Reference files'],
}

for (const [role, sections] of Object.entries(ROLES)) {
  test(`${role}: AGENT.md exists and stays small`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    assert(text.length > 800, 'persona is suspiciously short')
    assert(text.length < 12000, `persona is ${text.length} chars; move detail into references/`)
    for (const section of sections) {
      assert(text.includes(section), `missing section: ${section}`)
    }
  })

  test(`${role}: every referenced file exists`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    const refs = [...text.matchAll(/`((?:references|examples)\/[^`]+\.md)`/g)].map((match) => match[1])
    assert(refs.length > 0, 'the persona must point at reference files')
    for (const ref of new Set(refs)) {
      assert(exists(`agents/${role}/${ref}`), `referenced but missing: ${ref}`)
    }
  })

  test(`${role}: every shipped reference is reachable from the persona`, () => {
    const text = read(`agents/${role}/AGENT.md`)
    for (const directory of ['references', 'examples']) {
      const path = join(ROOT, 'agents', role, directory)
      if (!existsSync(path)) continue
      for (const file of readdirSync(path).filter((name) => name.endsWith('.md'))) {
        assert(
          text.includes(`${directory}/${file}`),
          `${directory}/${file} exists but no instruction says when to read it`,
        )
      }
    }
  })

  test(`${role}: references have a title and are substantial`, () => {
    const path = join(ROOT, 'agents', role, 'references')
    for (const file of readdirSync(path).filter((name) => name.endsWith('.md'))) {
      const text = readFileSync(join(path, file), 'utf8')
      assert(/^#\s+\S/m.test(text), `${file}: needs a level-1 heading`)
      assert(text.length > 400, `${file}: too thin (${text.length} chars)`)
    }
  })
}

test('sourced material names its source', () => {
  for (const file of ['agents/review/references/rubric.md', 'agents/simplify/references/anti-patterns.md']) {
    const text = read(file)
    assert(/Source:/.test(text), `${file} must state where its material comes from`)
    assert(/Apache-2\.0|claude-plugins-official|Codex/.test(text), `${file} must name the upstream`)
  }
})

// ---------------------------------------------------------------------------
// C. report parser
// ---------------------------------------------------------------------------

const bareReport = JSON.stringify({
  findings: [
    {
      title: '[P1] Guard the header',
      body: '`header.cwd` throws when the caller omits the header.',
      confidence_score: 0.8,
      priority: 1,
      code_location: { absolute_file_path: 'E:\\app\\src\\server.js', line_range: { start: 3, end: 4 } },
    },
  ],
  overall_correctness: 'patch is incorrect',
  overall_explanation: 'The change drops a default parameter.',
  overall_confidence_score: 0.8,
})

test('parser: bare JSON report', () => {
  const report = parseReport(bareReport)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
  assertEqual(report.findings[0].priority, 1, 'priority')
  assertEqual(report.findings[0].start, 3, 'start')
  assertEqual(report.findings[0].end, 4, 'end')
  assertEqual(report.correctness, 'patch is incorrect', 'correctness')
})

test('parser: JSON wrapped in a fence with prose around it', () => {
  const raw = `Here is my review.\n\n\`\`\`json\n${bareReport}\n\`\`\`\n\nLet me know.`
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
})

test('parser: braces inside prose do not hide the report', () => {
  const raw = `I looked at src/{a,b} and the config {draft} object.\n${bareReport}`
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'findings')
})

test('parser: tolerates P2 and a string line range', () => {
  const raw = JSON.stringify({
    findings: [{ title: 'Drift', body: 'Two copies.', priority: 'P2', file: 'src/a.js', line: '12-14' }],
    overall_explanation: 'Minor.',
  })
  const report = parseReport(raw)
  assertEqual(report.findings[0].priority, 2, 'priority from "P2"')
  assertEqual(report.findings[0].start, 12, 'start from string range')
  assertEqual(report.findings[0].end, 14, 'end from string range')
  assertEqual(report.findings[0].path, 'src/a.js', 'path alias')
})

test('parser: a finding without a location is kept but renders without a link', () => {
  const raw = JSON.stringify({
    findings: [{ title: 'Vague', body: 'Something feels off.' }],
    overall_explanation: 'Not much to say.',
  })
  const report = parseReport(raw)
  assertEqual(report.format, 'structured', 'format')
  assertEqual(report.findings.length, 1, 'a finding with no location is still a finding')
  assertEqual(report.findings[0].path, '', 'path')
  const text = renderReport(report, t)
  assert(!text.includes(']('), 'renders without a link')
  assert(text.includes('Vague'), 'title survives')
})

test('parser: picks the last valid object when several appear', () => {
  const first = JSON.stringify({ findings: [], overall_explanation: 'draft', overall_correctness: 'x' })
  const second = JSON.stringify({ findings: [], overall_explanation: 'final', overall_correctness: 'y' })
  const report = parseReport(`${first}\n${second}`)
  assertEqual(report.summary, 'final', 'summary')
})

test('parser: malformed input falls back to text', () => {
  const raw = '# Review\n\nLooks fine to me.'
  const report = parseReport(raw)
  assertEqual(report.format, 'text', 'format')
  assertEqual(report.summary, raw, 'summary')
})

test('renderer: adds a priority tag and a line-anchored file link', () => {
  const text = renderReport(parseReport(bareReport), t)
  assert(text.includes('[P1] Guard the header'), 'priority tag')
  assert(/\]\(E:%5Capp%5Csrc%5Cserver\.js#L3-L4\)/.test(text) || text.includes('#L3-L4'), 'line fragment')
  assert(text.includes('server.js:3–4'), 'range label')
})

test('renderer: does not double-tag a title that already has one', () => {
  const text = renderReport(parseReport(bareReport), t)
  assert(!text.includes('[P1] [P1]'), 'double tag')
})

test('renderer: text fallback is passed through unchanged', () => {
  const raw = '## Findings\n\nNothing.'
  assertEqual(renderReport(parseReport(raw), t), raw, 'passthrough')
})

// ---------------------------------------------------------------------------
// D. prompt assembly
// ---------------------------------------------------------------------------

await testAsync('scope: working tree', async () => {
  const text = await scopeInstruction({ mode: 'worktree' })
  assert(text.includes('git status --short'), 'mentions git status')
  assert(text.includes('git diff HEAD'), 'mentions git diff')
})

await testAsync('scope: commit carries the ref and title', async () => {
  const text = await scopeInstruction({ mode: 'commit', ref: 'abc123', title: 'fix: guard' })
  assert(text.includes('abc123'), 'ref')
  assert(text.includes('fix: guard'), 'title')
})

await testAsync('scope: files lists every path', async () => {
  const text = await scopeInstruction({ mode: 'files', paths: ['src/a.js', 'src/b.js'] })
  assert(text.includes('`src/a.js`') && text.includes('`src/b.js`'), 'paths')
})

await testAsync('scope: custom instructions are passed verbatim', async () => {
  const text = await scopeInstruction({ mode: 'instructions', text: 'only the auth module' })
  assert(text.includes('only the auth module'), 'instructions')
})

await testAsync('scope: base without a repository still gives a usable instruction', async () => {
  const text = await scopeInstruction({ mode: 'base', ref: 'main' })
  assert(text.includes('merge-base'), 'fallback mentions merge-base')
  assert(text.includes('main'), 'names the base ref')
})

test('scope labels stay short', () => {
  assertEqual(scopeLabel({ mode: 'commit', ref: '0123456789abcdef' }), 'commit 0123456789', 'commit label')
  assertEqual(scopeLabel({ mode: 'worktree' }), 'working tree vs HEAD', 'worktree label')
  const long = scopeLabel({ mode: 'instructions', text: 'x'.repeat(200) })
  assert(long.length <= 61, `label is ${long.length} chars`)
})

test('argument parsing keeps --apply out of the scope text', () => {
  const parsed = parseArgs('--files src/a.js,src/b.js --apply')
  assertEqual(parsed.apply, true, 'apply')
  assertEqual(parsed.scope.mode, 'files', 'mode')
  assertEqual(parsed.scope.paths.length, 2, 'paths')
  const custom = parseArgs('look at the auth flow --apply')
  assertEqual(custom.scope.mode, 'instructions', 'custom mode')
  assertEqual(custom.scope.text, 'look at the auth flow', 'custom text')
})

// ---------------------------------------------------------------------------
// E. locale
// ---------------------------------------------------------------------------

test('locale: eight official languages resolve, unknown falls back to English', () => {
  assertEqual(resolveLocale('zh-CN'), 'zh', 'zh-CN')
  assertEqual(resolveLocale('ja'), 'ja', 'ja')
  assertEqual(resolveLocale('pt-BR'), 'pt', 'pt-BR')
  assertEqual(resolveLocale('it-IT'), 'en', 'unknown tag')
  assertEqual(resolveLocale(''), 'zh', 'empty')
})

test('locale: every key used by index.js is translated', () => {
  const index = read('index.js')
  const keys = [...index.matchAll(/t\('([a-zA-Z.]+)'\)/g)].map((match) => match[1])
  for (const key of new Set(keys)) {
    assert(translate('zh', key) !== key, `zh is missing ${key}`)
    assert(translate('en', key) !== key, `en is missing ${key}`)
  }
})

test('locale: output language names the target', () => {
  assert(outputLanguage('de').includes('German'), 'de')
  assert(outputLanguage('zh').includes('Chinese'), 'zh')
})

// ---------------------------------------------------------------------------
// F. eval cases
// ---------------------------------------------------------------------------

const caseRoot = join(ROOT, 'evals', 'cases')
const cases = readdirSync(caseRoot).filter((name) => statSync(join(caseRoot, name)).isDirectory())

test('there is at least one case per mode', () => {
  const modes = cases.map((name) => JSON.parse(read(`evals/cases/${name}/expected.json`)).mode)
  for (const mode of ['review', 'simplify', 'scrub', 'caption']) {
    assert(modes.includes(mode), `no case with mode "${mode}"`)
  }
})

test('every agent role has an eval case, and every case has a role', () => {
  const roles = readdirSync(join(ROOT, 'agents')).filter((name) =>
    statSync(join(ROOT, 'agents', name)).isDirectory(),
  )
  const modes = new Set(cases.map((name) => JSON.parse(read(`evals/cases/${name}/expected.json`)).mode))
  for (const role of roles) {
    assert(modes.has(role), `agents/${role} ships without any eval case`)
  }
  for (const mode of modes) {
    assert(roles.includes(mode), `eval case uses mode "${mode}" but there is no agents/${mode}`)
  }
})

for (const name of cases) {
  test(`case ${name}: well formed`, () => {
    const dir = join(caseRoot, name)
    assert(existsSync(join(dir, 'README.md')), 'README.md explains the case')
    assert(existsSync(join(dir, 'before')), 'before/ tree')
    const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
    assert(['review', 'simplify', 'scrub', 'caption', 'pua'].includes(expected.mode), 'mode')
    if (['simplify', 'caption', 'pua'].includes(expected.mode)) {
      assert(Array.isArray(expected.requireGroups) && expected.requireGroups.length, 'requireGroups')
    } else {
      assert(Array.isArray(expected.findings), 'findings array')
      for (const finding of expected.findings) {
        assert(typeof finding.file === 'string', 'finding.file')
        assert(Number.isInteger(finding.line), 'finding.line')
        assert(Number.isInteger(finding.priority), 'finding.priority')
      }
      assert(typeof expected.clean === 'boolean', 'clean flag')
      if (expected.mustNotLeak !== undefined) {
        assert(Array.isArray(expected.mustNotLeak), 'mustNotLeak is an array')
        assert(expected.mustNotLeak.every((item) => typeof item === 'string'), 'mustNotLeak entries are strings')
      }
    }
  })
}

// ---------------------------------------------------------------------------
// G. plugin wiring
// ---------------------------------------------------------------------------

test('apply() registers every command against a stub host', () => {
  const registered = []
  const ctx = {
    effect: (fn) => {
      fn()
      return () => {}
    },
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }

  apply(ctx, {})

  const names = registered.map((definition) => definition.name).sort()
  assertEqual(
    names.join(','),
    'code-cancel,code-caption,code-review,code-scrub,code-simplify,code-status,pua',
    'registered commands',
  )
  for (const definition of registered) {
    assert(typeof definition.description === 'string' && definition.description.length > 0, `${definition.name}: description`)
    assert(typeof definition.handler === 'function', `${definition.name}: handler`)
  }
})

test('spawn commands keep their input claim so the menu inserts instead of running', () => {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, {})

  // A host command without `input` is executed the moment it is picked from the
  // `/` menu (Tab included): there is no way to insert the token and keep
  // typing. The cost is that the composer stays read-only until the handler
  // settles; that trade-off is deliberate and documented in docs/DETAIL.md.
  for (const name of ['code-review', 'code-simplify', 'code-scrub', 'code-caption']) {
    const definition = registered.find((item) => item.name === name)
    assert(definition !== undefined, `${name} is registered`)
    assert(
      definition.input !== undefined,
      `${name} must declare input — without it the menu executes on pick and Tab cannot insert`,
    )
  }
})

test('flags: sub and report are stripped from the line', () => {
  const inline = splitFlags('--base main')
  assertEqual(inline.sub, false, 'inline by default')
  assertEqual(inline.report, false, 'apply by default')
  assertEqual(inline.rest, '--base main', 'the line survives')

  const sub = splitFlags('sub --base main')
  assertEqual(sub.sub, true, 'sub is detected')
  assertEqual(sub.rest, '--base main', 'sub is removed from the line')

  const report = splitFlags('--files a.js REPORT')
  assertEqual(report.report, true, 'report is case-insensitive and positional')
  assertEqual(report.rest, '--files a.js', 'the flag is stripped')

  const both = splitFlags('sub report')
  assertEqual(both.sub, true, 'both flags')
  assertEqual(both.report, true, 'both flags')
  assertEqual(both.rest, '', 'nothing left')
})

await testAsync('delivery: the report arrives as a user message the model must relay', async () => {
  const message = reportMessage('## 审查 · 完成\n\n1 条发现', 'Write all user-facing text in Simplified Chinese.')
  assertEqual(message.role, 'user', 'role')
  assertEqual(message.content[0].type, 'text', 'content block type')
  assert(message.source.kind === 'morning-start-code-toolkit', 'the plugin names its own source kind')
  assert(typeof message.id === 'string' && message.id.length > 0, 'every message carries an id')
  assert(message.content[0].text.includes('verbatim'), 'the model is told to relay, not re-run')
  assert(message.content[0].text.includes('Simplified Chinese'), 'the output language travels with the report')

  const failure = failureMessage('no scope', 'Write in English.')
  assert(failure.content[0].text.includes('did not complete'), 'a failure is delivered too')
  assert(failure.content[0].text.includes('no scope'), 'the failure keeps its detail')

  const plain = userMessage('x')
  assert(plain.content[0].text === 'x', 'plain text passes through')

  const zh = reportMessage('报告正文', 'Write in Chinese.', true)
  assert(zh.content[0].text.includes('原样转述'), 'the wrapper follows the host language')
})

test('every command goes through the one session shell', () => {
  const index = read('index.js')
  assert(!index.includes('ctx.commands.register'), 'index.js must not register commands directly')
  const shell = read('src/command.js')
  assert(shell.includes('export class SessionCommand'), 'the shell is one class')
  assert(shell.includes('ctx.commands.register'), 'the shell owns registration')
  for (const kind of ["'inject'", "'local'", 'startInline', 'startIsolated']) {
    assert(shell.includes(kind), `the shell is missing ${kind}`)
  }
})

await testAsync('scope: an empty line means the command default', async () => {
  const project = await selectScope({ get: () => undefined }, {}, '', undefined, (key) => key)
  assertEqual(project.scope.mode, 'project', 'project by default')

  const branch = await selectScope({ get: () => undefined }, {}, '', undefined, (key) => key, 'branch')
  assertEqual(branch.scope.mode, 'branch', 'a command can pick its own default')

  const text = await scopeInstruction({ mode: 'project' })
  assert(text.includes('whole project'), 'the instruction names the whole project')
  assertEqual(scopeLabel({ mode: 'project' }), 'whole project', 'label')
  assertEqual(scopeLabel({ mode: 'branch' }), 'current branch', 'branch label')

  const explicit = await selectScope({ get: () => undefined }, {}, '--files a.js', undefined, (key) => key)
  assertEqual(explicit.scope.mode, 'files', 'an explicit line still wins')
})

await testAsync('scope: a branch resolves to a base, or to the recent commits', async () => {
  const scope = await resolveScope({ mode: 'branch' }, { cwd: ROOT })
  // A dirty tree reviews the working tree; a clean one reviews the branch, or a
  // window when the branch has no base. What must never happen is an empty diff.
  assert(['worktree', 'base', 'recent'].includes(scope.mode), `unexpected scope ${scope.mode}`)
  if (scope.mode === 'recent') {
    assertEqual(scope.count, 5, 'window size')
    const text = await scopeInstruction(scope, { cwd: ROOT })
    assert(text.includes('last 5 commits'), 'the instruction names the window')
    assertEqual(scopeLabel(scope), 'last 5 commits', 'label')
  } else if (scope.mode === 'base') {
    assert(typeof scope.ref === 'string' && scope.ref.length > 0, 'a base ref is named')
    assertEqual(scopeLabel(scope), `HEAD vs ${scope.ref}`, 'label')
  } else {
    assertEqual(scopeLabel(scope), 'working tree vs HEAD', 'label')
  }
})

await testAsync('scope: --branch picks the branch to compare against', async () => {
  const picked = parseArgs('--branch develop')
  assertEqual(picked.scope.mode, 'base', 'a branch comparison')
  assertEqual(picked.scope.ref, 'develop', 'and it names the branch')

  const legacy = parseArgs('--base main')
  assertEqual(legacy.scope.ref, 'main', '--base still works')

  // An explicit branch is a deliberate choice: it survives a dirty tree.
  const dir = join(ROOT, 'tmp', 'scope-branch')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  git('init', '-q')
  git('config', 'user.email', 'probe@example.com')
  git('config', 'user.name', 'probe')
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  git('add', 'a.txt')
  git('commit', '-q', '-m', 'init')
  writeFileSync(join(dir, 'b.txt'), 'b\n')

  const explicit = await resolveScope(parseArgs('--branch main').scope, { cwd: dir })
  assertEqual(explicit.mode, 'base', 'an explicit branch is honoured even when dirty')
  assertEqual(explicit.ref, 'main', 'and keeps the ref')

  const implicit = await resolveScope(parseArgs('').scope ?? { mode: 'branch' }, { cwd: dir })
  assertEqual(implicit.mode, 'worktree', 'the default still follows the dirty tree')

  const branches = await branchList(dir)
  assert(branches.includes('main') || branches.includes('master'), 'the branch list names the local branch')

  rmSync(dir, { recursive: true, force: true })
})

await testAsync('scope: a dirty tree reviews the uncommitted work, a clean one the branch', async () => {
  const dir = join(ROOT, 'tmp', 'scope-dirty')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  git('init', '-q')
  git('config', 'user.email', 'probe@example.com')
  git('config', 'user.name', 'probe')
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  git('add', 'a.txt')
  git('commit', '-q', '-m', 'init')

  assertEqual((await resolveScope({ mode: 'branch' }, { cwd: dir })).mode, 'recent', 'clean tree, no base')

  writeFileSync(join(dir, 'b.txt'), 'b\n')
  assertEqual((await resolveScope({ mode: 'branch' }, { cwd: dir })).mode, 'worktree', 'dirty tree wins')

  rmSync(dir, { recursive: true, force: true })
})

await testAsync('scope: a clean working tree has nothing to review', async () => {
  const dir = join(ROOT, 'tmp', 'scope-probe')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  git('init', '-q')
  git('config', 'user.email', 'probe@example.com')
  git('config', 'user.name', 'probe')
  writeFileSync(join(dir, 'a.txt'), 'a\n')
  git('add', 'a.txt')
  git('commit', '-q', '-m', 'init')

  assertEqual(await scopeHasChanges({ mode: 'worktree' }, { cwd: dir }), false, 'clean tree')
  writeFileSync(join(dir, 'b.txt'), 'b\n')
  assertEqual(await scopeHasChanges({ mode: 'worktree' }, { cwd: dir }), true, 'untracked counts')

  const dirty = await resolveScope({ mode: 'branch' }, { cwd: dir })
  assertEqual(dirty.mode, 'worktree', 'a dirty repo reviews the uncommitted work')
  assertEqual(await scopeHasChanges(dirty, { cwd: dir }), true, 'and it is never empty')

  rmSync(dir, { recursive: true, force: true })
})

test('caption: dispatch names the two mechanisms and forbids mixing them', () => {
  const text = read('agents/caption/AGENT.md')
  for (const marker of ['`subagent`', '/code-review sub', 'does not see this conversation']) {
    assert(text.includes(marker), `AGENT.md is missing ${marker}`)
  }
  const reference = read('agents/caption/references/dispatch.md')
  assert(reference.includes('One mechanism per slice'), 'the reference forbids mixing')
  assert(reference.includes('single-flight'), 'the reference explains the sub cap')
})

await testAsync('review: a run past the timeout releases its slot', async () => {
  const agent = {
    id: 'agent-timeout',
    session: { id: 'session-timeout', header: { cwd: 'C:\\work\\demo' } },
    followup: () => {},
  }
  const store = join(ROOT, 'tmp', 'timeout-journal')
  rmSync(store, { recursive: true, force: true })
  const definition = reviewDefinition({ reportDirectory: store, runTimeoutMinutes: 0 })
  const first = await definition.handler({ agent, rawInput: 'sub report', signal: new AbortController().signal })
  const second = await definition.handler({ agent, rawInput: 'sub report', signal: new AbortController().signal })
  assertEqual(first.kind, 'success', 'the first run is accepted')
  assertEqual(second.kind, 'success', 'a stale slot is released instead of blocking forever')
  rmSync(store, { recursive: true, force: true })
})

test('caption: the expert method is referenced and carries the five parts', () => {
  const protocol = read('agents/caption/AGENT.md')
  assert(protocol.includes('references/experts.md'), 'AGENT.md points at the expert method')
  assert(protocol.includes('An expert is a paragraph, not a file'), 'the protocol says what an expert is')

  const experts = read('agents/caption/references/experts.md')
  for (const part of ['Identity and bar', 'What it looks at', 'What counts as a finding', 'What is not a finding', 'Output shape']) {
    assert(experts.includes(part), `the method is missing: ${part}`)
  }
  assert(experts.includes('Weak:') && experts.includes('Strong:'), 'the method shows a weak and a strong brief')
  assert(experts.includes('No delegation'), 'an expert reports instead of spawning')
  assert(read('agents/caption/references/dispatch.md').includes('references/experts.md'), 'dispatch points at it too')
})

test('caption: the two flows are named, gated on approval, and referenced', () => {
  const protocol = read('agents/caption/AGENT.md')
  assert(protocol.includes('references/flows.md'), 'AGENT.md points at the flows')
  assert(protocol.includes('The approval gate is not optional'), 'the protocol states the gate')

  const flows = read('agents/caption/references/flows.md')
  for (const step of ['Requirement', 'Investigate', 'Propose', 'Execute', 'Summary']) {
    assert(flows.includes(step), `the doc flow is missing: ${step}`)
  }
  for (const step of ['Test', 'Human confirms', 'Update the docs']) {
    assert(flows.includes(step), `the code flow is missing: ${step}`)
  }
  assert(flows.includes('Flow A') && flows.includes('Flow B'), 'both flows are named')
  assert(flows.includes('The approval gate is real'), 'the gate is stated in the flows too')
  assert(flows.includes('Delete before you add'), 'the doc flow has its own rules')
})

await testAsync('simplify: an apply run carries the approved plan instead of re-deriving it', async () => {
  const store = join(ROOT, 'tmp', 'plan-journal')
  rmSync(store, { recursive: true, force: true })
  const agent = {
    id: 'agent-plan',
    session: { id: 'session-plan', header: { cwd: 'C:\\work\\demo' } },
    followup: (message) => { delivered.push(message) },
  }
  const delivered = []
  const definition = simplifyDefinition({ reportDirectory: store, runTimeoutMinutes: 0.0001 })

  // A finished dry-run report for the same scope, written the way the shell writes it.
  const journal = new Journal(store)
  await journal.write('session-plan', {
    state: 'finished',
    command: 'simplify',
    scope: 'whole project',
    mode: 'dry-run',
    result: '## 计划\n\n1. 合并两处重复的解析逻辑',
    at: new Date().toISOString(),
  })

  const result = await definition.handler({ agent, rawInput: '', signal: new AbortController().signal })
  assertEqual(result.kind, 'success', 'kind')
  await new Promise((resolve) => setTimeout(resolve, 50))
  const text = delivered[0]?.content?.[0]?.text ?? ''
  assert(text.includes('合并两处重复的解析逻辑'), 'the approved plan travels with the task')
  assert(text.includes('已由人看过并批准'), 'and says it was approved')
  rmSync(store, { recursive: true, force: true })
})

await testAsync('simplify: a stale plan is not carried over', async () => {
  const store = join(ROOT, 'tmp', 'plan-stale')
  rmSync(store, { recursive: true, force: true })
  const delivered = []
  const agent = {
    id: 'agent-stale',
    session: { id: 'session-stale', header: { cwd: 'C:\\work\\demo' } },
    followup: (message) => { delivered.push(message) },
  }
  const definition = simplifyDefinition({ reportDirectory: store, runTimeoutMinutes: 0.0001, planMaxAgeMinutes: 0 })
  const journal = new Journal(store)
  await journal.write('session-stale', {
    state: 'finished',
    command: 'simplify',
    scope: 'whole project',
    mode: 'dry-run',
    result: '## 计划\n\n1. 旧计划',
    at: new Date(Date.now() - 60_000).toISOString(),
  })

  await definition.handler({ agent, rawInput: '', signal: new AbortController().signal })
  await new Promise((resolve) => setTimeout(resolve, 50))
  const text = delivered[0]?.content?.[0]?.text ?? ''
  assert(!text.includes('旧计划'), 'an expired plan is dropped')
  rmSync(store, { recursive: true, force: true })
})

await testAsync('receipt: the message says where the task went and what it will do', async () => {
  const store = join(ROOT, 'tmp', 'receipt-journal')
  rmSync(store, { recursive: true, force: true })
  const agent = {
    id: 'agent-receipt',
    session: { id: 'session-receipt', header: { cwd: 'C:\\work\\demo' } },
    followup: () => {},
  }
  const definition = simplifyDefinition({ reportDirectory: store, runTimeoutMinutes: 0 })

  const inline = await definition.handler({ agent, rawInput: '', signal: new AbortController().signal })
  assert(inline.text.includes('当前会话'), 'an inline run says it went to the session')
  assert(!inline.text.includes('子 agent'), 'and does not claim a subagent')

  const plan = await definition.handler({ agent, rawInput: 'report', signal: new AbortController().signal })
  assert(plan.text.includes('方案'), 'a report run says a plan comes first')
  assert(plan.text.includes('不改任何文件'), 'and that nothing will change')

  // The isolated path resolves its scope before it settles, so this one awaits.
  // It runs last: the journal it writes is the one the next call would read.
  const sub = await definition.handler({ agent, rawInput: 'sub', signal: new AbortController().signal })
  assert(sub.text.includes('独立子 agent'), 'a sub run says it went to an isolated agent')
})

test('review: apply mode reports the fixes it made, dry-run does not', () => {
  const withFixes = parseReport(JSON.stringify({
    findings: [{ title: 'Guard the null header', body: 'x', priority: 1, code_location: { absolute_file_path: 'C:\\a.js', line_range: { start: 3, end: 3 } } }],
    overall_explanation: 'One finding.',
    fixed: [{ title: 'Guard the null header', file: 'C:\\a.js', change: 'Added a guard.', verified_by: 'node --test → 12 pass' }],
  }))
  assertEqual(withFixes.fixed.length, 1, 'the fix is parsed')
  const rendered = renderReport(withFixes, (key) => key)
  assert(rendered.includes('report.fixed'), 'the fixed section is rendered')
  assert(rendered.includes('node --test → 12 pass'), 'and carries the verification')

  const dryRun = parseReport(JSON.stringify({ findings: [], overall_explanation: 'Clean.' }))
  assertEqual(dryRun.fixed.length, 0, 'no fixes in a dry-run report')
  assert(!renderReport(dryRun, (key) => key).includes('report.fixed'), 'and no section either')
})

test('caption: experts can be created mid-run, under the same lane rules', () => {
  const protocol = read('agents/caption/AGENT.md')
  assert(protocol.includes('## Creating experts mid-run'), 'the protocol has the mid-run section')
  for (const marker of ['Write the brief first, in the ledger', 'Decide the lane', 'Dispatch, then keep working', 'Merge against the brief', 'Record it']) {
    assert(protocol.includes(marker), `the mid-run section is missing: ${marker}`)
  }
  assert(protocol.includes('Do not create an expert to avoid a decision'), 'the section says when not to')

  const experts = read('agents/caption/references/experts.md')
  assert(experts.includes('## When to create one mid-run'), 'the reference says when')
  assert(experts.includes('## The lifecycle of an expert'), 'the reference has the lifecycle')
  assert(experts.includes('The quiet failure'), 'and names the quiet failures')
})

test('apply() rejects an invalid config instead of failing later', () => {
  const ctx = {
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: () => {} },
  }
  let threw = false
  try {
    apply(ctx, { reportDirectory: 'relative/dir' })
  } catch {
    threw = true
  }
  assert(threw, 'a relative reportDirectory must be rejected')
})

function captionDefinition(config = {}) {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, config)
  return registered.find((definition) => definition.name === 'code-caption')
}

function reviewDefinition(config = {}) {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, config)
  return registered.find((definition) => definition.name === 'code-review')
}

function simplifyDefinition(config = {}) {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, config)
  return registered.find((definition) => definition.name === 'code-simplify')
}

test('simplify: no gate, no apply, and the plan ranks by value', () => {  const text = read('agents/simplify/AGENT.md')
  for (const marker of [
    'Value before volume',
    'characterization baseline',
    'do not apply',
    'anchor is unique',
    'Files read in full',
    'behaviour-risk',
  ]) {
    assert(text.includes(marker), `the simplify protocol is missing: ${marker}`)
  }
  const verification = read('agents/simplify/references/verification.md')
  assert(verification.includes('When the project has no tests'), 'verification.md lost the no-suite protocol')
})

test('caption: the protocol carries the loop, not a checklist', () => {
  const text = read('agents/caption/AGENT.md')
  for (const marker of ['Read the ledger first', 'Verify', 'Record one caption entry', 'dead end', 'unverified']) {
    assert(text.includes(marker), `the protocol is missing: ${marker}`)
  }
})

test('caption: dispatch is limited to slices that cannot collide', () => {
  const text = read('agents/caption/AGENT.md')
  for (const marker of [
    'Analysis is read-only',
    'disjoint',
    'exactly one owner',
    'Never run two writers on the same path',
  ]) {
    assert(text.includes(marker), `the dispatch rule is missing: ${marker}`)
  }
  const reference = read('agents/caption/references/dispatch.md')
  for (const marker of ['exclusive', 'shared files', 'Merging']) {
    assert(reference.toLowerCase().includes(marker.toLowerCase()), `dispatch.md is missing: ${marker}`)
  }
})

await testAsync('caption: a second run adds the task, not a second protocol', async () => {
  const store = join(ROOT, 'tmp', 'caption-journal')
  rmSync(store, { recursive: true, force: true })
  const definition = captionDefinition({ reportDirectory: store })
  const steered = []
  const agent = {
    id: 'a1',
    session: { id: 'session-caption', header: { cwd: 'C:\\work\\demo' } },
    steer: (message) => { steered.push(message) },
  }

  const first = await definition.handler({ agent, rawInput: 'first task' })
  const second = await definition.handler({ agent, rawInput: 'second task' })

  assertEqual(first.kind, 'success', 'first kind')
  assertEqual(second.kind, 'success', 'second kind')
  assertEqual(steered.length, 2, 'both are steered')
  const [one, two] = steered.map((message) => message.content[0].text)
  assert(one.includes('Record one caption entry'), 'the first run carries the protocol')
  assert(!two.includes('Record one caption entry'), 'the second run does not repeat it')
  assert(two.includes('second task'), 'the second run still carries its task')
  assert(two.includes('already installed'), 'and says why it is short')
  assert(second.text.includes('只补了任务'), 'the receipt says so')

  rmSync(store, { recursive: true, force: true })
})

await testAsync('caption: the ledger directory is configurable', async () => {
  const agent = {
    id: 'a1',
    session: { header: { cwd: 'C:\\work\\demo' } },
    steer: () => {},
  }
  const relative = captionDefinition({ ledgerDirectory: 'notes/caption' })
  const result = await relative.handler({ agent, rawInput: 'x' })
  assert(result.text.includes(join('C:\\work\\demo', 'notes', 'caption')), 'a relative path resolves against the project')

  const absolute = captionDefinition({ ledgerDirectory: 'D:\\ledgers' })
  const fixed = await absolute.handler({ agent, rawInput: 'x' })
  assert(fixed.text.includes('D:\\ledgers'), 'an absolute path is used as is')

  let failed = false
  try {
    captionDefinition({ ledgerDirectory: '  ' })
  } catch (error) {
    failed = /ledgerDirectory/.test(String(error?.message))
  }
  assert(failed, 'an empty ledgerDirectory fails at load')
})

await testAsync('caption: task and protocol are steered into the session', async () => {
  const store = join(ROOT, 'tmp', 'caption-journal-fresh')
  rmSync(store, { recursive: true, force: true })
  const definition = captionDefinition({ reportDirectory: store })
  const steered = []
  const agent = {
    id: 'a1',
    session: { id: 'session-caption-fresh', header: { cwd: 'C:\\work\\demo' } },
    steer: (message) => { steered.push(message) },
  }

  const result = await definition.handler({ agent, rawInput: 'make the suite green' })

  assertEqual(result.kind, 'success', 'kind')
  assertEqual(steered.length, 1, 'exactly one steered message')
  const text = steered[0].content[0].text
  assert(text.includes('make the suite green'), 'carries the task')
  assert(text.includes('Reference directory:'), 'names the reference directory')
  assert(text.includes('Record one caption entry'), 'carries the loop')
  assert(text.includes('caption'), 'names the ledger directory')
  assertUserMessage(steered[0], 'caption steer')
  assertEqual(steered[0].source?.kind, 'morning-start-code-toolkit', 'the host sees a plugin request, not a typed message')
  rmSync(store, { recursive: true, force: true })
})

await testAsync('caption: an empty task falls back to the current work', async () => {
  const definition = captionDefinition()
  const steered = []
  const agent = { id: 'a1', session: { header: { cwd: 'C:\\work\\demo' } }, steer: (m) => steered.push(m) }

  const result = await definition.handler({ agent, rawInput: '   ' })

  assertEqual(result.kind, 'success', 'kind')
  assertEqual(steered.length, 1, 'the protocol is still installed')
  assert(steered[0].content[0].text.includes('继续当前会话'), 'the default task says so')
})

await testAsync('caption: a host without steer fails loudly', async () => {
  const definition = captionDefinition()
  const agent = { id: 'a1', session: { header: { cwd: 'C:\\work\\demo' } } }

  const result = await definition.handler({ agent, rawInput: 'do the thing' })

  assertEqual(result.kind, 'error', 'kind')
  assert(result.text.length > 0, 'says why it cannot run')
})

// ---------------------------------------------------------------------------

function puaDefinition() {
  const registered = []
  apply({
    effect: () => () => {},
    get: () => undefined,
    on: () => () => {},
    commands: { register: (definition) => registered.push(definition) },
  }, {})
  return registered.find((definition) => definition.name === 'pua')
}

await testAsync('pua: list names the flavors without steering anything', async () => {
  const steered = []
  const agent = {
    id: 'a1',
    session: { header: { cwd: 'C:\\work\\demo' } },
    steer: async (message) => steered.push(message),
  }
  const result = await puaDefinition().handler({ agent, rawInput: 'list' })
  assertEqual(result.kind, 'success', 'kind')
  assert(result.text.includes('alibaba'), 'names the flavors')
  assertEqual(steered.length, 0, 'list must not steer')
})

await testAsync('pua: a flavor is steered together with the protocol', async () => {
  const steered = []
  const agent = {
    id: 'a1',
    session: { header: { cwd: 'C:\\work\\demo' } },
    steer: async (message) => steered.push(message),
  }
  const result = await puaDefinition().handler({ agent, rawInput: 'huawei' })
  assertEqual(result.kind, 'success', 'kind')
  assertEqual(steered.length, 1, 'exactly one steer')
  const text = steered[0].content[0].text
  assert(text.includes('Three red lines'), 'the protocol travels with the flavor')
  assert(text.includes('华为'), 'the chosen flavor is the one injected')
  assertUserMessage(steered[0], 'pua steer')
})

test('delivery: only complete UserMessages reach the host', () => {
  // The host writes a steered or queued message straight into a `user/message`
  // session event. A partial `{ content, source }` has no id and no role, so the
  // log fails validation on the next load and the conversation cannot be opened.
  // Guarding the call sites here is cheaper than discovering it in a session log.
  const files = ['index.js', 'src/command.js', 'src/delivery.js']
  for (const file of files) {
    const text = read(file)
    for (const method of ['steer', 'followup', 'inject', 'send']) {
      assert(!new RegExp(`\\.${method}\\(\\{`).test(text), `${file}: ${method} must not take an object literal`)
    }
  }

  // Both delivery paths go through the one builder that adds id, role, and source.
  assert(read('src/command.js').includes('agent.steer(userMessage('), 'steer takes a built UserMessage')
  assert(/agent\.followup\(message\)/.test(read('index.js')), 'followup takes a built message')
  const built = userMessage('x')
  assertUserMessage(built, 'userMessage')
  assertUserMessage(reportMessage('r', 'Write in English.'), 'reportMessage')
  assertUserMessage(failureMessage('f', 'Write in English.'), 'failureMessage')
  // A fresh identity per message: two deliveries must not share one id, or the
  // second is a duplicate of the first in the log.
  assert(userMessage('a').id !== userMessage('b').id, 'every message gets its own id')
})

// ---------------------------------------------------------------------------
// I. identity: every piece of per-session state is keyed by one rule
// ---------------------------------------------------------------------------

test('identity: sessionKey picks the session id, falls back to the agent id', () => {
  assertEqual(sessionKey({ session: { id: 'session-1' }, id: 'agent-1' }), 'session-1', 'the session id wins')
  assertEqual(sessionKey({ id: 'agent-1' }), 'agent-1', 'the agent id is the fallback')
  assertEqual(sessionKey({ session: {}, id: 'agent-1' }), 'agent-1', 'a session without an id falls back')
  assertEqual(sessionKey({ session: { id: '   ' }, id: 'agent-1' }), 'agent-1', 'a blank session id falls back')
  assertEqual(sessionKey({ session: { id: 7 }, id: 'agent-1' }), 'agent-1', 'a non-string session id falls back')
  assertEqual(sessionKey({}), undefined, 'no id means no key')
  assertEqual(sessionKey(null), undefined, 'a missing agent means no key')
})

test('journal: a missing id is rejected, not coerced into one shared file', () => {
  const journal = new Journal(join(ROOT, 'tmp', 'identity-journal'))
  assertThrows(() => journal.path(undefined), /session id/, 'undefined')
  assertThrows(() => journal.path(''), /session id/, 'empty string')
  assertThrows(() => journal.path('   '), /session id/, 'blank string')
  assertThrows(() => journal.path(null), /session id/, 'null')
  assertThrows(() => journal.path(7), /session id/, 'a number')
})

test('identity: one rule keys every piece of per-session state', () => {
  const shell = read('src/command.js')
  const entry = read('index.js')
  // The old inline expression is gone from both, so a run's single-flight slot
  // and its journal record cannot be keyed by two different ids.
  assert(!shell.includes('agent.session?.id ?? agent.id'), 'the shell resolves identity in one place')
  assert(!entry.includes('agent.session?.id ?? agent.id'), 'the local commands resolve identity in one place')
  assert(shell.includes('sessionKey(agent)'), 'the shell uses the shared key')
  assert(entry.includes('sessionKey(agent)'), 'the local commands use the shared key')
})

await testAsync('identity: an isolated run without an id is refused, not queued on a shared key', async () => {
  const store = join(ROOT, 'tmp', 'identity-noid')
  rmSync(store, { recursive: true, force: true })
  // A working directory, so the shell gets past its first check, but neither a
  // session id nor an agent id: the run must refuse rather than register under
  // `undefined` and crowd every other unidentified session into one slot.
  const agent = {
    session: { header: { cwd: 'C:\\work\\demo' } },
    followup: () => {},
  }
  const definition = reviewDefinition({ reportDirectory: store, runTimeoutMinutes: 0 })
  const result = await definition.handler({ agent, rawInput: 'sub report', signal: new AbortController().signal })
  assertEqual(result.kind, 'error', 'kind')
  assert(result.text.includes('会话标识'), `names the missing identity: ${result.text}`)
  rmSync(store, { recursive: true, force: true })
})

await testAsync('identity: a child that never gets its persona fails the run loudly', async () => {
  // The host resolves the activation but never emits agent/created for the child
  // id the plugin handed it. Without the injected flag the child would have run
  // with no persona, and its result would have been reported as a good report.
  let listener
  const ctx = {
    subagents: {
      getProvider: () => ({ inheritsParentContext: false }),
      startActivation: async () => ({
        result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'a report' }] }),
        dispose: async () => {},
      }),
    },
    tools: { get: () => undefined },
    on: (event, handler) => { listener = handler; return () => {} },
  }
  let error
  try {
    await runIsolatedAgent(ctx, { id: 'parent' }, {
      persona: 'the persona',
      prompt: 'do it',
      label: 'a label',
      signal: new AbortController().signal,
      t: (key) => translate('en', key),
    })
  } catch (thrown) {
    error = thrown
  }
  assert(error, 'the run must fail instead of reporting a persona-less result')
  assert(error.message.includes('persona'), `names the missing persona: ${error.message}`)
  assert(typeof listener === 'function', 'the listener was registered for the child')
})

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailures:')
  for (const failure of failures) console.log(`- ${failure.name}: ${failure.message}`)
  process.exit(1)
}
